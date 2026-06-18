"""Provider-agnostic TTS layer for the audiobook chapter render.

Three providers supported, picked via TTS_PROVIDER env var:
  - elevenlabs: best voices, character-distinguishable. ELEVENLABS_API_KEY required.
  - 60db:       60db.ai TTS. SIXTYDB_API_KEY required. Honours speaking speed and
                returns base64-wrapped audio (decoded here). Voice ids are
                account-specific UUIDs — map archetypes via SIXTYDB_VOICE_* env
                vars, else fall back to the account's system-default voice.
  - openai:     decent voices, cheaper. Uses OPENAI_API_KEY (or KIMI key fallback if compatible).

Voice profile is derived from a character's genome — high courage + low empathy gets
a deeper, harder voice; high cunning + high ambition gets a smoother, conspiratorial one.
The mapping is intentionally simple: pick a base voice id for the active provider, then
nudge speaking rate / stability based on traits.

If no provider is configured, synthesize() raises — caller must check is_configured()
before invoking. The audio chapter is optional in the demo; missing TTS does not
break the wiki.
"""
import asyncio
import base64
import logging
import os
import random
from pathlib import Path
from typing import Literal

import httpx

logger = logging.getLogger(__name__)


Provider = Literal["elevenlabs", "60db", "openai", "none"]


def get_provider() -> Provider:
    p = os.getenv("TTS_PROVIDER", "").strip().lower()
    if p in ("60db", "sixtydb"):
        return "60db"
    if p in ("elevenlabs", "openai"):
        return p  # type: ignore[return-value]
    return "none"


def is_configured() -> bool:
    p = get_provider()
    if p == "elevenlabs":
        return bool(os.getenv("ELEVENLABS_API_KEY"))
    if p == "60db":
        return bool(os.getenv("SIXTYDB_API_KEY"))
    if p == "openai":
        return bool(os.getenv("OPENAI_API_KEY"))
    return False


# --------------------------------------------------------------------------- #
#  Voice profile derivation                                                    #
# --------------------------------------------------------------------------- #

# Base voice ids per provider. ElevenLabs ids are public-catalog defaults;
# the user can override per-character via Genome → voice_id mapping in env later.
_ELEVENLABS_DEFAULTS = {
    "narrator":  "EXAVITQu4vr4xnSDxMaL",  # Sarah — warm, neutral
    "warrior":   "TxGEqnHWrfWFTfGW9XjX",  # Josh — deep, masculine
    "schemer":   "AZnzlk1XvdvUeBnXmlld",  # Domi — sharp, female
    "scholar":   "21m00Tcm4TlvDq8ikWAM",  # Rachel — clear, scholarly
    "mystic":    "MF3mGyEYCl7XYWbV9V6O",  # Elli — soft, ethereal
}

_OPENAI_DEFAULTS = {
    "narrator":  "alloy",
    "warrior":   "onyx",
    "schemer":   "echo",
    "scholar":   "nova",
    "mystic":    "shimmer",
}

# 60db voice ids are account-specific UUIDs (see GET /myvoices), so there are no
# safe hardcoded defaults like ElevenLabs has. Map each archetype to an env var;
# if unset, voice_id_for returns "" and _sixtydb_synth omits voice_id entirely so
# 60db falls back to the account's system-default voice.
_SIXTYDB_VOICE_ENV = {
    "narrator":  "SIXTYDB_VOICE_NARRATOR",
    "warrior":   "SIXTYDB_VOICE_WARRIOR",
    "schemer":   "SIXTYDB_VOICE_SCHEMER",
    "scholar":   "SIXTYDB_VOICE_SCHOLAR",
    "mystic":    "SIXTYDB_VOICE_MYSTIC",
}


def voice_archetype_from_genome(genome: dict) -> str:
    """Map a 6-trait Genesis genome to one of 5 voice archetypes."""
    courage = genome.get("courage", 0.5)
    cunning = genome.get("cunning", 0.5)
    loyalty = genome.get("loyalty", 0.5)
    ambition = genome.get("ambition", 0.5)
    empathy = genome.get("empathy", 0.5)
    resilience = genome.get("resilience", 0.5)

    if courage > 0.7 and resilience > 0.6:
        return "warrior"
    if cunning > 0.7 and ambition > 0.6:
        return "schemer"
    if empathy > 0.7 and loyalty > 0.6:
        return "scholar"
    if cunning > 0.6 and empathy < 0.4:
        return "mystic"
    return "narrator"


def voice_id_for(archetype: str) -> str:
    p = get_provider()
    if p == "elevenlabs":
        return _ELEVENLABS_DEFAULTS.get(archetype, _ELEVENLABS_DEFAULTS["narrator"])
    if p == "60db":
        env = _SIXTYDB_VOICE_ENV.get(archetype, _SIXTYDB_VOICE_ENV["narrator"])
        # Empty string → caller omits voice_id → 60db uses its system default.
        return os.getenv(env, "")
    if p == "openai":
        return _OPENAI_DEFAULTS.get(archetype, _OPENAI_DEFAULTS["narrator"])
    return archetype


# --------------------------------------------------------------------------- #
#  Synthesis                                                                   #
# --------------------------------------------------------------------------- #

async def synthesize(
    text: str,
    archetype: str = "narrator",
    output_path: str | Path | None = None,
    speed: float = 1.0,
) -> Path:
    """Render `text` to an mp3 using the active TTS provider.

    Returns the path to the written file. Caller should set CHRONICLON_DIR/audio
    or pass an explicit output_path.
    """
    if not is_configured():
        raise RuntimeError(
            "TTS not configured. Set TTS_PROVIDER=elevenlabs|openai and the matching API key."
        )
    provider = get_provider()
    voice = voice_id_for(archetype)

    if output_path is None:
        from config import CHRONICLON_DIR
        output_path = Path(CHRONICLON_DIR) / "audio" / f"{archetype}_{abs(hash(text)) % 10**8}.mp3"
    else:
        output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if provider == "elevenlabs":
        return await _elevenlabs_synth(text, voice, output_path, speed)
    if provider == "60db":
        return await _sixtydb_synth(text, voice, output_path, speed)
    if provider == "openai":
        return await _openai_synth(text, voice, output_path, speed)
    raise RuntimeError(f"unsupported provider: {provider}")


async def _post_with_backoff(client: httpx.AsyncClient, url: str, *, headers: dict, json: dict, max_retries: int = 5) -> httpx.Response:
    """POST with exponential backoff on 429s and transient 5xx. Honours
    `Retry-After` if the server sends it, otherwise 1.5^N + jitter. The
    audio backfill ran into bursty 429s on OpenAI without backoff and
    failed 77/80 articles; this is the fix."""
    delay = 1.0
    for attempt in range(max_retries):
        resp = await client.post(url, headers=headers, json=json)
        if resp.status_code == 429 or resp.status_code >= 500:
            if attempt == max_retries - 1:
                resp.raise_for_status()
            retry_after = resp.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                wait = float(retry_after)
            else:
                wait = delay + random.uniform(0, delay * 0.3)
                delay *= 1.8
            logger.warning(f"TTS {resp.status_code} from {url} — sleeping {wait:.1f}s (attempt {attempt + 1}/{max_retries})")
            await asyncio.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    raise RuntimeError(f"TTS exhausted {max_retries} retries on {url}")


async def _elevenlabs_synth(text: str, voice_id: str, output_path: Path, speed: float) -> Path:
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    body = {
        "text": text,
        "model_id": os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
        "voice_settings": {
            "stability": 0.55,
            "similarity_boost": 0.75,
            "style": 0.15,
            "use_speaker_boost": True,
        },
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await _post_with_backoff(client, url, headers=headers, json=body)
        output_path.write_bytes(resp.content)
    logger.info(f"elevenlabs synth → {output_path} ({len(resp.content)} bytes)")
    return output_path


def _env_float(name: str, default: float, lo: float, hi: float) -> float:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return max(lo, min(hi, float(raw)))
    except ValueError:
        logger.warning(f"invalid {name}={raw!r}, using default {default}")
        return default


async def _sixtydb_synth(text: str, voice_id: str, output_path: Path, speed: float) -> Path:
    """60db.ai TTS. Unlike ElevenLabs/OpenAI (raw audio bytes), 60db returns a
    JSON envelope with base64-encoded audio, so we decode before writing.

    `voice_id` is "" when no SIXTYDB_VOICE_* override is set — we then omit it and
    let 60db use the account's system-default voice. stability/similarity are on a
    0-100 scale here (ElevenLabs uses 0-1) and speed (0.5-2.0) is actually honoured.

    output_format stays mp3: the serving route and audio_chapter both assume a
    `<slug>.mp3` written as audio/mpeg. Overriding it would desync the extension.
    """
    api_key = os.getenv("SIXTYDB_API_KEY", "")
    url = "https://api.60db.ai/tts-synthesize"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "text": text,
        "enhance": os.getenv("SIXTYDB_ENHANCE", "true").strip().lower() != "false",
        "speed": max(0.5, min(2.0, speed)),
        "stability": _env_float("SIXTYDB_STABILITY", 50.0, 0.0, 100.0),
        "similarity": _env_float("SIXTYDB_SIMILARITY", 75.0, 0.0, 100.0),
        "output_format": os.getenv("SIXTYDB_OUTPUT_FORMAT", "mp3"),
    }
    if voice_id:
        body["voice_id"] = voice_id
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await _post_with_backoff(client, url, headers=headers, json=body)
        data = resp.json()
        if not data.get("success", True):
            raise RuntimeError(f"60db tts failed: {data.get('message', 'unknown error')}")
        b64 = data.get("audio_base64")
        if not b64:
            raise RuntimeError(f"60db tts: no audio_base64 in response: {str(data)[:200]}")
        audio_bytes = base64.b64decode(b64)
        output_path.write_bytes(audio_bytes)
    logger.info(f"60db tts synth → {output_path} ({len(audio_bytes)} bytes)")
    return output_path


async def _openai_synth(text: str, voice_id: str, output_path: Path, speed: float) -> Path:
    api_key = os.getenv("OPENAI_API_KEY", "")
    url = "https://api.openai.com/v1/audio/speech"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": os.getenv("OPENAI_TTS_MODEL", "tts-1"),
        "input": text,
        "voice": voice_id,
        "response_format": "mp3",
        "speed": max(0.25, min(4.0, speed)),
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await _post_with_backoff(client, url, headers=headers, json=body)
        output_path.write_bytes(resp.content)
    logger.info(f"openai tts synth → {output_path} ({len(resp.content)} bytes)")
    return output_path
