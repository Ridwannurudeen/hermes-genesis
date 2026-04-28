"""Provider-agnostic TTS layer for the audiobook chapter render.

Two providers supported, picked via TTS_PROVIDER env var:
  - elevenlabs: best voices, character-distinguishable. ELEVENLABS_API_KEY required.
  - openai:     decent voices, cheaper. Uses OPENAI_API_KEY (or KIMI key fallback if compatible).

Voice profile is derived from a character's genome — high courage + low empathy gets
a deeper, harder voice; high cunning + high ambition gets a smoother, conspiratorial one.
The mapping is intentionally simple: pick a base voice id for the active provider, then
nudge speaking rate / stability based on traits.

If no provider is configured, synthesize() raises — caller must check is_configured()
before invoking. The audio chapter is optional in the demo; missing TTS does not
break the wiki.
"""
import logging
import os
from pathlib import Path
from typing import Literal

import httpx

logger = logging.getLogger(__name__)


Provider = Literal["elevenlabs", "openai", "none"]


def get_provider() -> Provider:
    p = os.getenv("TTS_PROVIDER", "").strip().lower()
    if p in ("elevenlabs", "openai"):
        return p  # type: ignore[return-value]
    return "none"


def is_configured() -> bool:
    p = get_provider()
    if p == "elevenlabs":
        return bool(os.getenv("ELEVENLABS_API_KEY"))
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
    if provider == "openai":
        return await _openai_synth(text, voice, output_path, speed)
    raise RuntimeError(f"unsupported provider: {provider}")


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
        resp = await client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        output_path.write_bytes(resp.content)
    logger.info(f"elevenlabs synth → {output_path} ({len(resp.content)} bytes)")
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
        resp = await client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        output_path.write_bytes(resp.content)
    logger.info(f"openai tts synth → {output_path} ({len(resp.content)} bytes)")
    return output_path
