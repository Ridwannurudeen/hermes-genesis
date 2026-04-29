"""Adversarial critic loop. Hermes-4 judges every Kimi-written article.

Critics:
  - antislop: 0.0–1.0, harshness for formulaic / fourth-wall / empty prose
  - factcheck: scores against canon facts, flags hard contradictions
  - crosslink: proposes [[slug]] insertions for cross-references

A standard pass runs antislop + factcheck. Articles below thresholds get
returned to the writer for one revision attempt.

All three critics use Hermes-native ``<tool_call>`` format for structured
output (via `llm.call_with_tool`). This is far more reliable than asking
for bare JSON — it bypasses the trailing-comma / unquoted-keys / truncation
problems that the 4-tier `extract_json` repair tower was designed to paper
over. The repair tower remains as a fallback so prompts in transition
keep working.
"""
import logging

from llm import call_with_tool
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


_ANTISLOP_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {
            "type": "number",
            "description": "Anti-slop score, 0.0 (pure slop) to 1.0 (zero slop). Be harsh.",
        },
        "offenses": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Up to 5 specific quoted offenses with brief explanation.",
        },
        "top_fix": {
            "type": "string",
            "description": "Single most important fix, actionable.",
        },
        "fourth_wall_breaks": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Any moments referencing AI / simulation / reader / fiction.",
        },
    },
    "required": ["score"],
}


_FACTCHECK_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "number", "description": "0.0 (rejects) to 1.0 (no contradictions)."},
        "contradictions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "conflicts_with": {"type": "string"},
                    "severity": {"type": "string", "enum": ["hard", "soft"]},
                },
            },
        },
        "verdict": {"type": "string", "enum": ["approve", "revise", "reject"]},
    },
    "required": ["score"],
}


_CROSSLINK_SCHEMA = {
    "type": "object",
    "properties": {
        "links": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "slug": {"type": "string"},
                    "anchor_text": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["slug", "anchor_text"],
            },
        },
    },
    "required": ["links"],
}


async def antislop_score(article_md: str) -> dict:
    data = await call_with_tool(
        system=ANTISLOP_SYSTEM,
        user=antislop_prompt(article_md),
        tool_name="submit_antislop",
        tool_description="Submit the anti-slop score and offenses for this article.",
        parameters_schema=_ANTISLOP_SCHEMA,
        temperature=0.2,
        max_tokens=900,
        provider="nous",
    )
    if not data:
        return {"score": 0.5, "offenses": [], "top_fix": "", "fourth_wall_breaks": []}
    try:
        return {
            "score": float(data.get("score", 0.5)),
            "offenses": data.get("offenses", []) or [],
            "top_fix": data.get("top_fix", "") or "",
            "fourth_wall_breaks": data.get("fourth_wall_breaks", []) or [],
        }
    except (TypeError, ValueError) as e:
        logger.warning(f"antislop_score coerce failed: {e}")
        return {"score": 0.5, "offenses": [], "top_fix": "", "fourth_wall_breaks": []}


async def factcheck_score(article_md: str, canon_facts: list[str]) -> dict:
    data = await call_with_tool(
        system=FACTCHECK_SYSTEM,
        user=factcheck_prompt(article_md, canon_facts),
        tool_name="submit_factcheck",
        tool_description="Submit the fact-check verdict, score, and any contradictions found.",
        parameters_schema=_FACTCHECK_SCHEMA,
        temperature=0.1,
        max_tokens=900,
        provider="nous",
    )
    if not data:
        return {"score": 1.0, "contradictions": [], "verdict": "approve"}
    contradictions = data.get("contradictions", []) or []
    if not isinstance(contradictions, list):
        contradictions = []
    hard = sum(1 for c in contradictions if isinstance(c, dict) and c.get("severity") == "hard")
    try:
        score = float(data.get("score", 1.0))
    except (TypeError, ValueError):
        score = 1.0
    if hard > 0:
        score = min(score, 0.4)
    return {
        "score": score,
        "contradictions": contradictions,
        "verdict": data.get("verdict", "approve") or "approve",
    }


async def crosslink_propose(article_md: str, available: list[dict]) -> list[dict]:
    if not available:
        return []
    data = await call_with_tool(
        system=CROSSLINK_SYSTEM,
        user=crosslink_prompt(article_md, available),
        tool_name="submit_crosslinks",
        tool_description="Submit cross-link proposals as a list of slug + anchor_text pairs.",
        parameters_schema=_CROSSLINK_SCHEMA,
        temperature=0.2,
        max_tokens=700,
        provider="nous",
    )
    if not data:
        return []
    links = data.get("links", []) or []
    return [link for link in links if isinstance(link, dict)]


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
