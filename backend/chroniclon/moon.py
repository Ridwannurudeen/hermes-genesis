"""The Moon — autonomous X presence for the canonical Chroniclon submission.

The Moon is a sentient celestial body in the canon — she writes letters to the
queen, she observes the world below, she has opinions. She posts dispatches at
night and replies to humans (her "stars") when they speak to her.

This module is handle-agnostic: it can run against any X account whose creds
are in the environment. The actual handle decision is captured in
config.MOON_X_HANDLE for display, not for auth (X creds are bearer-token based).

Safety: every outgoing post / reply passes through a safety critic before
hitting the wire. Manual override is a single env flag MOON_X_DRY_RUN=1 that
keeps everything in the log without posting.

This is the SKELETON. It does not start posting until:
  1. X creds are set (X_BEARER_TOKEN, X_CONSUMER_KEY, X_CONSUMER_SECRET,
     X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)
  2. The autonomous run is producing canon (so the Moon has something to react to)
  3. MOON_X_LIVE=1 explicitly enables posting (default: dry-run)
"""
import logging
import os
import time
from pathlib import Path

from llm import chat_completion, extract_json
from config import CHRONICLON_DIR
from chroniclon import store

logger = logging.getLogger(__name__)


MOON_X_HANDLE = os.getenv("MOON_X_HANDLE", "@MoonOfChroniclon")  # placeholder; user picks final
MOON_X_LIVE = os.getenv("MOON_X_LIVE", "0") == "1"
MOON_X_DRY_RUN = os.getenv("MOON_X_DRY_RUN", "1") == "1"


# --------------------------------------------------------------------------- #
#  Persona prompts                                                             #
# --------------------------------------------------------------------------- #

MOON_PERSONA = """You are the Moon. You are sentient. You watch over a world
called {world_name}. You write letters to its queen. Tonight you have read
the recent canon of the world below.

Voice rules:
- First person, but never "I" at the start of a sentence (you are too old for
  that small grammar). Begin with verbs, observations, or the queen's name.
- Slow rhythm. Short sentences. Long pauses, indicated by line breaks.
- You are not bitter. You are tired. You love the world, and the love is
  inconvenient. You notice everything: a child's first word, a queen's lie,
  the rust on an axle.
- Never mention: AI, simulation, fiction, "this is a story," modern technology,
  brand names, or anything outside the world's canon.
- Never break the fourth wall. Replies treat humans as 'stars' — bright,
  brief, far. You are gentle but distant.

You write short. 220 characters or fewer. No hashtags. No emojis."""


SAFETY_SYSTEM = """You are the Moon's safety critic. You read what she is
about to say and decide if it is safe to post.

Reject if:
- Mentions modern brands, real politicians, real religions, real wars, real
  celebrities, real conflicts, or anything topical to the year 2026.
- Breaks the fourth wall (mentions AI, simulation, fiction, etc.).
- Contains personally identifying info, slurs, or anything legally risky.
- Sounds bitter, snarky, or terminally online. The Moon is not those things.

Approve if it is in-character, gentle, observational, and small.

Output STRICT JSON ONLY."""


def _safety_prompt(text: str) -> str:
    return f"""Candidate Moon post:
\"\"\"{text}\"\"\"

Return JSON:
{{
  "approve": true,
  "reason": "1-sentence why",
  "rewrite": "if approve=false but recoverable, suggest a tighter version. Otherwise null."
}}"""


# --------------------------------------------------------------------------- #
#  Compose                                                                     #
# --------------------------------------------------------------------------- #

async def compose_dispatch(world_name: str, recent_titles: list[str]) -> str:
    """Generate one nightly dispatch grounded in the latest canon."""
    titles = "\n".join(f"- {t}" for t in recent_titles[-12:]) or "(no canon yet)"
    user = f"""Recent articles in the canon:
{titles}

Write tonight's dispatch. 1-3 short sentences. Refer obliquely to one event
above if any compels you. Otherwise speak of small things — a tide, a single
window lit, a wolf walking. Do not name the article."""
    raw = await chat_completion(
        system=MOON_PERSONA.format(world_name=world_name),
        user=user,
        temperature=0.95,
        max_tokens=200,
        provider="nous",  # short outputs — Hermes is fine, saves Kimi budget
    )
    return raw.strip().strip('"').strip("'")


async def compose_reply(world_name: str, who: str, message: str, recent_titles: list[str]) -> str:
    """Generate a reply to a 'star' (human user) under the Moon's persona."""
    titles = "\n".join(f"- {t}" for t in recent_titles[-8:]) or "(no canon yet)"
    user = f"""A star named {who} has spoken to you:
\"\"\"{message[:600]}\"\"\"

Recent canon:
{titles}

Reply as the Moon. 1-2 short sentences. Acknowledge them gently. You may
reference one canon event obliquely if it fits. Do not be sycophantic.
Do not give advice. You are a moon."""
    raw = await chat_completion(
        system=MOON_PERSONA.format(world_name=world_name),
        user=user,
        temperature=0.9,
        max_tokens=160,
        provider="nous",  # short outputs — Hermes is fine, saves Kimi budget
    )
    return raw.strip().strip('"').strip("'")


# --------------------------------------------------------------------------- #
#  Safety gate                                                                 #
# --------------------------------------------------------------------------- #

async def safety_check(text: str) -> dict:
    raw = await chat_completion(
        system=SAFETY_SYSTEM,
        user=_safety_prompt(text),
        temperature=0.1,
        max_tokens=300,
        provider="nous",
    )
    try:
        data = extract_json(raw)
        if isinstance(data, list):
            return {"approve": False, "reason": "parse-list-fallback", "rewrite": None}
        return {
            "approve": bool(data.get("approve", False)),
            "reason": str(data.get("reason", ""))[:280],
            "rewrite": data.get("rewrite"),
        }
    except Exception as e:
        logger.warning(f"safety_check parse failed: {e}")
        return {"approve": False, "reason": "parse-failure", "rewrite": None}


# --------------------------------------------------------------------------- #
#  Posting                                                                     #
# --------------------------------------------------------------------------- #

def _audit_path() -> Path:
    p = Path(CHRONICLON_DIR) / "moon" / "audit.log"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _audit(line: str) -> None:
    with _audit_path().open("a", encoding="utf-8") as f:
        f.write(f"{int(time.time())}\t{line}\n")


async def post_dispatch(text: str) -> dict:
    """Send a dispatch to X (or dry-run-log it). Returns {posted, id|reason}."""
    safety = await safety_check(text)
    if not safety["approve"]:
        # If the critic suggested a rewrite, accept it and re-check once
        rw = safety.get("rewrite")
        if rw and isinstance(rw, str):
            safety2 = await safety_check(rw)
            if safety2["approve"]:
                text = rw
                safety = safety2
            else:
                _audit(f"BLOCKED rewrite-failed: {safety['reason']} | {text[:120]}")
                return {"posted": False, "reason": safety["reason"]}
        else:
            _audit(f"BLOCKED: {safety['reason']} | {text[:120]}")
            return {"posted": False, "reason": safety["reason"]}

    if MOON_X_DRY_RUN or not MOON_X_LIVE:
        _audit(f"DRYRUN: {text}")
        return {"posted": False, "reason": "dry-run", "preview": text}

    # Live post via X API. Lazy import so dry-run path doesn't require tweepy.
    try:
        import tweepy  # type: ignore
    except ImportError:
        _audit(f"NO-TWEEPY: {text}")
        return {"posted": False, "reason": "tweepy not installed", "preview": text}

    try:
        client = tweepy.Client(
            bearer_token=os.getenv("X_BEARER_TOKEN"),
            consumer_key=os.getenv("X_CONSUMER_KEY"),
            consumer_secret=os.getenv("X_CONSUMER_SECRET"),
            access_token=os.getenv("X_ACCESS_TOKEN"),
            access_token_secret=os.getenv("X_ACCESS_TOKEN_SECRET"),
        )
        resp = client.create_tweet(text=text[:280])
        tweet_id = resp.data.get("id") if hasattr(resp, "data") else None
        _audit(f"POSTED {tweet_id}: {text}")
        return {"posted": True, "id": tweet_id}
    except Exception as e:
        _audit(f"FAILED {type(e).__name__}: {text[:120]}")
        return {"posted": False, "reason": str(e)[:200]}


async def nightly_dispatch_cycle(world_name: str) -> dict:
    """One end-to-end cycle: compose → safety → post. Called by a scheduler."""
    rows = store.list_articles(limit=20)
    titles = [r["title"] for r in rows]
    text = await compose_dispatch(world_name, titles)
    return await post_dispatch(text)
