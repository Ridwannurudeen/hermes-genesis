import re
import httpx
import json
import logging
from config import NOUS_API_KEY, NOUS_BASE_URL, NOUS_MODEL, KIMI_API_KEY, KIMI_BASE_URL, KIMI_MODEL

logger = logging.getLogger(__name__)

# Per-provider client pool — reused across calls to avoid connection overhead
_clients: dict[str, httpx.AsyncClient] = {}

_PROVIDERS = {
    "nous": {"key": NOUS_API_KEY, "base": NOUS_BASE_URL, "model": NOUS_MODEL, "timeout": 120.0},
    "kimi": {"key": KIMI_API_KEY, "base": KIMI_BASE_URL, "model": KIMI_MODEL, "timeout": 300.0},
}


def _get_client(provider: str = "nous") -> httpx.AsyncClient:
    cfg = _PROVIDERS[provider]
    client = _clients.get(provider)
    if client is None or client.is_closed:
        client = httpx.AsyncClient(
            timeout=cfg["timeout"],
            headers={
                "Authorization": f"Bearer {cfg['key']}",
                "Content-Type": "application/json",
            },
        )
        _clients[provider] = client
    return client


def _coerce_temperature(provider: str, model: str, temperature: float) -> float:
    """Moonshot's Kimi K2.x line (K2.5, K2.6, …) only accepts temperature=1.
    Coerce silently rather than fail on the API's 400.
    """
    if provider == "kimi" and "k2." in model.lower():
        return 1.0
    return temperature


def _coerce_max_tokens(provider: str, model: str, max_tokens: int) -> int:
    """Kimi K2.6 emits hidden reasoning tokens BEFORE the final content.
    A small max_tokens budget gets entirely consumed by reasoning, leaving
    content empty. Floor reasoning models at a budget that leaves room
    for both reasoning AND the requested output. K2.5 is non-reasoning and
    needs no padding.
    """
    if provider == "kimi" and "k2.6" in model.lower():
        return max(max_tokens + 1024, 1500)
    return max_tokens


async def chat_completion(
    system: str,
    user: str,
    temperature: float = 0.9,
    max_tokens: int = 4000,
    retries: int = 2,
    provider: str = "nous",
    model: str | None = None,
) -> str:
    cfg = _PROVIDERS[provider]
    if provider == "kimi" and not cfg["key"]:
        logger.warning("KIMI_API_KEY missing — falling back to Nous Hermes")
        provider, cfg = "nous", _PROVIDERS["nous"]
    client = _get_client(provider)
    chosen_model = model or cfg["model"]
    chosen_temp = _coerce_temperature(provider, chosen_model, temperature)
    chosen_max = _coerce_max_tokens(provider, chosen_model, max_tokens)
    last_err = None
    for attempt in range(retries + 1):
        try:
            resp = await client.post(
                f"{cfg['base']}/chat/completions",
                json={
                    "model": chosen_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": chosen_temp,
                    "max_tokens": chosen_max,
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            msg = payload["choices"][0]["message"]
            content = (msg.get("content") or "").strip()
            if not content and msg.get("reasoning_content"):
                # Reasoning model produced no final answer — likely budget ran out
                # mid-reasoning. Surface the partial reasoning so the caller can
                # log/skip rather than silently return empty.
                logger.warning(
                    f"empty content from {chosen_model}; reasoning consumed budget "
                    f"({chosen_max} tokens). Bump max_tokens or shorten prompt."
                )
            return content
        except Exception as e:
            last_err = e
            if attempt < retries:
                logger.warning(f"LLM call failed (provider={provider}, attempt {attempt + 1}): {e}")
            else:
                raise last_err


async def close_client():
    for client in _clients.values():
        if not client.is_closed:
            await client.aclose()
    _clients.clear()


def _repair_json(text: str) -> str:
    """Attempt to fix common LLM JSON errors."""
    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    # Fix single quotes to double quotes (but not inside strings)
    # Only if there are no double quotes at all (LLM used all single quotes)
    if '"' not in text and "'" in text:
        text = text.replace("'", '"')
    # Remove control characters
    text = re.sub(r"[\x00-\x1f\x7f]", " ", text)
    # Fix unquoted keys: { key: -> { "key":
    text = re.sub(r"(?<=[\{,])\s*(\w+)\s*:", r' "\1":', text)
    return text


def _truncate_at_last_complete(text: str) -> str:
    """If JSON is truncated (LLM hit max_tokens), close it at the last complete item."""
    # Find the last complete object/array boundary
    last_close = max(text.rfind("}"), text.rfind("]"))
    if last_close > 0:
        # Walk backwards to find a valid stopping point
        candidate = text[:last_close + 1]
        # Close any remaining open brackets
        opens = candidate.count("[") - candidate.count("]")
        candidate += "]" * max(0, opens)
        opens = candidate.count("{") - candidate.count("}")
        candidate += "}" * max(0, opens)
        return candidate
    return text


def extract_json(text: str) -> dict | list:
    """Extract JSON from LLM response with repair fallback."""
    text = text.strip()

    # Strip markdown code fences (with bounds checking)
    if "```json" in text:
        parts = text.split("```json", 1)
        if len(parts) > 1:
            inner = parts[1].split("```", 1)
            text = inner[0].strip()
    elif "```" in text:
        parts = text.split("```", 2)
        if len(parts) > 1:
            text = parts[1].strip()

    # Find the outermost JSON object or array
    # This handles cases where LLM adds text before/after the JSON
    start = -1
    brace = None
    for i, ch in enumerate(text):
        if ch in ("{", "["):
            start = i
            brace = ch
            break

    if start >= 0:
        # Find matching closing bracket
        close = "}" if brace == "{" else "]"
        depth = 0
        for i in range(start, len(text)):
            if text[i] == brace:
                depth += 1
            elif text[i] == close:
                depth -= 1
                if depth == 0:
                    text = text[start : i + 1]
                    break
        else:
            # No matching close found — LLM response was truncated
            text = text[start:]

    # First try: parse as-is
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Second try: repair common issues
    repaired = _repair_json(text)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # Third try: truncation recovery — close brackets at last complete item
    truncated = _truncate_at_last_complete(repaired)
    try:
        return json.loads(truncated)
    except json.JSONDecodeError:
        pass

    # Fourth try: use higher max_tokens hint — try to extract partial valid data
    # Find longest valid JSON prefix
    for end in range(len(repaired), 100, -50):
        candidate = repaired[:end]
        candidate = _truncate_at_last_complete(candidate)
        try:
            result = json.loads(candidate)
            logger.warning(f"JSON recovered by truncation at char {end}/{len(repaired)}")
            return result
        except json.JSONDecodeError:
            continue

    logger.error(f"JSON extraction failed after all repair attempts\nText: {text[:500]}")
    raise json.JSONDecodeError("Could not parse LLM JSON after repairs", text, 0)
