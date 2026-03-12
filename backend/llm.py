import httpx
import json
from config import NOUS_API_KEY, NOUS_BASE_URL, NOUS_MODEL

async def chat_completion(system: str, user: str, temperature: float = 0.9, max_tokens: int = 4000) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{NOUS_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {NOUS_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": NOUS_MODEL,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

def extract_json(text: str) -> dict | list:
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)
