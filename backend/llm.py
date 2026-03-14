import re
import httpx
import json
import logging
from config import NOUS_API_KEY, NOUS_BASE_URL, NOUS_MODEL

logger = logging.getLogger(__name__)


async def chat_completion(
    system: str,
    user: str,
    temperature: float = 0.9,
    max_tokens: int = 4000,
    retries: int = 2,
) -> str:
    last_err = None
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{NOUS_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {NOUS_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": NOUS_MODEL,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            last_err = e
            if attempt < retries:
                logger.warning(f"LLM call failed (attempt {attempt + 1}), retrying: {e}")
            else:
                raise last_err


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

    # Strip markdown code fences
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

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
    for end in range(len(repaired), 100, -1):
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
