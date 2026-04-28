"""Adversarial critic loop. Hermes-4 judges every Kimi-written article.

Critics:
  - antislop: 0.0–1.0, harshness for formulaic / fourth-wall / empty prose
  - factcheck: scores against canon facts, flags hard contradictions
  - crosslink: proposes [[slug]] insertions for cross-references

A standard pass runs antislop + factcheck. Articles below thresholds get
returned to the writer for one revision attempt.
"""
import logging

from llm import chat_completion, extract_json
from chroniclon.prompts import (
    ANTISLOP_SYSTEM,
    FACTCHECK_SYSTEM,
    CROSSLINK_SYSTEM,
    antislop_prompt,
    factcheck_prompt,
    crosslink_prompt,
)

logger = logging.getLogger(__name__)


# Articles below this anti-slop score get one revision (revisions = double Kimi cost,
# so we tightened to revise fewer first-pass-acceptable articles).
ANTISLOP_REVISE_THRESHOLD = 0.45
# Hard contradictions reject; soft ones revise
FACTCHECK_REVISE_THRESHOLD = 0.60


async def antislop_score(article_md: str) -> dict:
    raw = await chat_completion(
        system=ANTISLOP_SYSTEM,
        user=antislop_prompt(article_md),
        temperature=0.2,
        max_tokens=800,
        provider="nous",
    )
    try:
        data = extract_json(raw)
        if isinstance(data, list):
            return {"score": 0.5, "offenses": [], "top_fix": "", "fourth_wall_breaks": []}
        return {
            "score": float(data.get("score", 0.5)),
            "offenses": data.get("offenses", []) or [],
            "top_fix": data.get("top_fix", "") or "",
            "fourth_wall_breaks": data.get("fourth_wall_breaks", []) or [],
        }
    except Exception as e:
        logger.warning(f"antislop_score parse failed: {e}")
        return {"score": 0.5, "offenses": [], "top_fix": "", "fourth_wall_breaks": []}


async def factcheck_score(article_md: str, canon_facts: list[str]) -> dict:
    raw = await chat_completion(
        system=FACTCHECK_SYSTEM,
        user=factcheck_prompt(article_md, canon_facts),
        temperature=0.1,
        max_tokens=800,
        provider="nous",
    )
    try:
        data = extract_json(raw)
        if isinstance(data, list):
            return {"score": 1.0, "contradictions": [], "verdict": "approve"}
        contradictions = data.get("contradictions", []) or []
        # Hard contradictions count more
        hard = sum(1 for c in contradictions if c.get("severity") == "hard")
        score = float(data.get("score", 1.0))
        if hard > 0:
            score = min(score, 0.4)
        return {
            "score": score,
            "contradictions": contradictions,
            "verdict": data.get("verdict", "approve") or "approve",
        }
    except Exception as e:
        logger.warning(f"factcheck_score parse failed: {e}")
        return {"score": 1.0, "contradictions": [], "verdict": "approve"}


async def crosslink_propose(article_md: str, available: list[dict]) -> list[dict]:
    if not available:
        return []
    raw = await chat_completion(
        system=CROSSLINK_SYSTEM,
        user=crosslink_prompt(article_md, available),
        temperature=0.2,
        max_tokens=600,
        provider="nous",
    )
    try:
        data = extract_json(raw)
        if isinstance(data, dict):
            return data.get("links", []) or []
        return []
    except Exception as e:
        logger.warning(f"crosslink_propose parse failed: {e}")
        return []


def apply_crosslinks(article_md: str, links: list[dict]) -> str:
    """Insert [[slug]] cross-links at the FIRST occurrence of each anchor.
    Skips anchors already inside an existing [[link]]."""
    out = article_md
    for link in links:
        slug = (link.get("slug") or "").strip()
        anchor = (link.get("anchor_text") or "").strip()
        if not slug or not anchor:
            continue
        # Already linked anywhere?
        if f"[[{slug}]]" in out:
            continue
        # Replace first occurrence outside an existing [[...]]
        marker = f"[[{slug}]]"
        idx = out.find(anchor)
        if idx < 0:
            continue
        # Skip if inside another link
        before = out[:idx]
        if before.count("[[") > before.count("]]"):
            continue
        out = out[:idx] + marker + out[idx + len(anchor):]
    return out
