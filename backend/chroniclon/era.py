"""Era system — compressed time + era-boundary transitions.

The civilization runs on compressed time: Genesis days map to in-world years
via an era multiplier, and at era boundaries we generate a new linguistic
drift snapshot, name the new era, write a summary article for the era that
just closed, and advance the cursor.

Era-end triggers are intentionally loose to keep the LLM in the driver's seat:
- After ~N canonized articles in the era, ask the canon agent if the era should
  close. If yes, generate a transition.
- Or: a "pivotal" event (war, succession, discovery) at high enough scale flips
  the era directly.
"""
import logging
import uuid
from datetime import datetime

from llm import chat_completion, extract_json
from chroniclon import store
from chroniclon.models import Era, LinguisticEra

logger = logging.getLogger(__name__)


# How many canonized articles before we start asking "should the era close?"
ERA_REVIEW_AFTER = 20
# Hard ceiling before we force an era close (keeps drift visible)
ERA_HARD_CLOSE_AT = 60


_ERA_CLOSE_SYSTEM = """You are the era-keeper of a fictional civilization.
You read the recent canon and decide whether the current era has ended and a
new one should begin. Eras are flavor packets — they have a name, an art style,
a dominant mood, and a set of factions in ascendance. They end when the world's
shape changes meaningfully (a long war ends, a faith collapses, a technology
emerges, a sovereign dies, a continent is rediscovered).

Output STRICT JSON ONLY."""


def _close_decision_prompt(world_name: str, current_era: Era, recent_titles: list[str]) -> str:
    titles_block = "\n".join(f"- {t}" for t in recent_titles[-25:]) or "(no recent titles)"
    return f"""World: "{world_name}"
Current era: "{current_era.name}" (ordinal {current_era.ordinal}, started year {current_era.start_year})
Era summary so far: {current_era.summary or "(none yet)"}

Recent canonized articles (most recent last):
{titles_block}

Has the current era ended? If yes, propose the next era's name, art style,
and a one-paragraph thematic premise.

Return JSON:
{{
  "close": false,
  "reasoning": "1 sentence",
  "next_era": {{
    "name": "The Cinder Era",
    "art_style": "charcoal woodcut, sepia tones, smoke-stained vellum",
    "premise": "1-2 sentence thematic premise of what this era is about"
  }}
}}

If "close" is false, omit "next_era" or set it to null."""


_LINGUISTIC_SYSTEM = """You are the linguistic chronicler of a fictional
civilization. The world's language drifts across eras as people change. You
maintain a small core lexicon — common nouns, kinship terms, divine names,
moods — and document how it shifts at era boundaries.

You are NOT a linguist for our reality. You are documenting a fictional
language that resembles real linguistic drift only loosely. Phonology notes
should be evocative and consistent across eras, not academically rigorous.

Output STRICT JSON ONLY."""


def _drift_prompt(
    world_name: str,
    new_era_name: str,
    new_era_year: int,
    parent_lex: dict[str, str],
    parent_phonology: str,
) -> str:
    parent_block = "\n".join(f"  {k}: {v}" for k, v in list(parent_lex.items())[:30])
    return f"""World: "{world_name}"
New era starting: "{new_era_name}" (in-world year {new_era_year})

PARENT ERA LEXICON (drift FROM these):
{parent_block or "(no parent — this is the founding lexicon)"}

PARENT ERA PHONOLOGY NOTES:
{parent_phonology or "(none)"}

Produce the new era's linguistic snapshot. Keep continuity — most words drift
slightly, a few replace entirely, and some new concepts get coined.

Return JSON:
{{
  "phonology_notes": "1-2 sentence drift description (e.g. 'fricatives soften, /θ/ → /s/; final vowels nasalise')",
  "sample_lexicon": {{
    "moon": "vael",
    "queen": "aelin",
    "...": "..."
  }},
  "sample_text": "one paragraph (40-80 words) of in-world prose IN THE NEW ERA'S DIALECT, evocative, no translation"
}}

The lexicon should keep ~20-30 core entries. Drift them, don't invent
unrelated words. Maintain a recognizable lineage from parent."""


def current_era() -> Era | None:
    eras = store.list_eras()
    return eras[-1] if eras else None


def should_review_close(era: Era) -> bool:
    """Cheap pre-filter — only call the LLM closer when there's enough canon."""
    n = store.article_count(era_id=era.era_id)
    return n >= ERA_REVIEW_AFTER


def must_close(era: Era) -> bool:
    """Hard ceiling so an era can't run forever (keeps linguistic drift visible)."""
    return store.article_count(era_id=era.era_id) >= ERA_HARD_CLOSE_AT


async def consider_close(world_name: str, era: Era) -> dict:
    """Ask the LLM if the current era has ended."""
    rows = store.list_articles(era_id=era.era_id, limit=30)
    titles = [r["title"] for r in rows]
    raw = await chat_completion(
        system=_ERA_CLOSE_SYSTEM,
        user=_close_decision_prompt(world_name, era, titles),
        temperature=0.4,
        max_tokens=600,
        provider="nous",
    )
    try:
        data = extract_json(raw)
        if isinstance(data, list):
            return {"close": False, "reasoning": "parse-list-fallback"}
        return data
    except Exception as e:
        logger.warning(f"era close parse failed: {e}")
        return {"close": False, "reasoning": "parse-failure"}


async def generate_drift(
    world_name: str,
    new_era_name: str,
    new_era_year: int,
) -> LinguisticEra:
    """Generate a new linguistic snapshot, drifting from the most recent one."""
    eras = store.list_linguistic_eras()
    parent = eras[-1] if eras else None
    parent_lex = parent.sample_lexicon if parent else {}
    parent_phon = parent.phonology_notes if parent else ""
    raw = await chat_completion(
        system=_LINGUISTIC_SYSTEM,
        user=_drift_prompt(world_name, new_era_name, new_era_year, parent_lex, parent_phon),
        temperature=0.85,
        max_tokens=1200,
        provider="nous",  # one-shot drift — no need for Kimi's long context here
    )
    try:
        data = extract_json(raw)
        if isinstance(data, list):
            data = {}
    except Exception as e:
        logger.warning(f"drift parse failed: {e}")
        data = {}

    le = LinguisticEra(
        era_id=f"lang_{uuid.uuid4().hex[:8]}",
        era_name=new_era_name,
        in_world_year=new_era_year,
        parent_era=parent.era_id if parent else None,
        phonology_notes=str(data.get("phonology_notes", "") or "")[:500],
        sample_lexicon=dict(data.get("sample_lexicon", {}) or {}),
        sample_text=str(data.get("sample_text", "") or "")[:1200],
    )
    store.save_linguistic_era(le)
    return le


async def transition_era(
    world_name: str,
    closing_era: Era,
    next_era_name: str,
    next_art_style: str,
    next_premise: str,
    in_world_year: int,
) -> Era:
    """Close the current era and open the next. Persists both, plus linguistic drift."""
    closing_era.end_year = in_world_year
    if not closing_era.summary:
        closing_era.summary = next_premise[:280]  # rough placeholder
    store.save_era(closing_era)

    new_era = Era(
        era_id=f"era_{closing_era.ordinal + 1}",
        name=next_era_name.strip()[:120] or f"Era {closing_era.ordinal + 1}",
        ordinal=closing_era.ordinal + 1,
        start_year=in_world_year,
        summary=next_premise[:600],
        art_style=next_art_style[:200],
        linguistic_era=None,
    )
    store.save_era(new_era)

    try:
        le = await generate_drift(world_name, new_era.name, in_world_year)
        new_era.linguistic_era = le.era_id
        store.save_era(new_era)
    except Exception as e:
        logger.warning(f"linguistic drift failed for {new_era.name}: {e}")

    logger.info(f"era transition: {closing_era.name} → {new_era.name} (year {in_world_year})")
    return new_era


async def maybe_advance_era(world_name: str, in_world_year: int) -> Era | None:
    """Called by the runner after each canonized event. Returns new Era if advanced."""
    era = current_era()
    if era is None:
        return None
    if must_close(era):
        # Force close with a synthetic next-era proposal if needed
        decision = await consider_close(world_name, era)
        next_era = decision.get("next_era") or {}
        name = next_era.get("name") or f"The {ordinal_word(era.ordinal + 1).title()} Age"
        art = next_era.get("art_style") or era.art_style
        premise = next_era.get("premise") or "A new chapter begins."
        return await transition_era(world_name, era, name, art, premise, in_world_year)
    if should_review_close(era):
        decision = await consider_close(world_name, era)
        if not decision.get("close"):
            return None
        next_era = decision.get("next_era") or {}
        if not next_era.get("name"):
            return None
        return await transition_era(
            world_name,
            era,
            next_era["name"],
            next_era.get("art_style", ""),
            next_era.get("premise", ""),
            in_world_year,
        )
    return None


def ordinal_word(n: int) -> str:
    words = [
        "founding", "second", "third", "fourth", "fifth", "sixth", "seventh",
        "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth",
    ]
    if 0 <= n < len(words):
        return words[n]
    return f"{n}th"


def linguistic_notes_for_era(era: Era) -> str:
    """Best-available linguistic notes blob to pass into article writers."""
    if not era.linguistic_era:
        return ""
    for le in store.list_linguistic_eras():
        if le.era_id == era.linguistic_era:
            lex_block = ", ".join(f"{k}={v}" for k, v in list(le.sample_lexicon.items())[:12])
            return f"Era voice: {le.phonology_notes}\nKey terms: {lex_block}\nSample: {le.sample_text}"
    return ""
