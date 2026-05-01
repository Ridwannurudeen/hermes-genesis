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
from chroniclon.models import Era, LinguisticEra, Inscription, Morphology, PhonologicalRule

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
civilization. The world's language drifts across eras. You maintain a small
core lexicon and document the shift at every era boundary with:
  - structured phonological rules (what sound became what, in which context)
  - morphology (plural, honorific, place-name suffixes, diminutive)
  - a few in-world inscriptions with translations
  - the lexicon and a sample paragraph

You are NOT a linguist for our reality. The drift is evocative, not academic.
Continuity matters: each era's rules describe how it diverged from its parent.

Output STRICT JSON ONLY."""


def _drift_prompt(
    world_name: str,
    new_era_name: str,
    new_era_year: int,
    parent_lex: dict[str, str],
    parent_phonology: str,
    parent_morphology: Morphology | None = None,
) -> str:
    parent_block = "\n".join(f"  {k}: {v}" for k, v in list(parent_lex.items())[:30])
    morph_block = ""
    if parent_morphology:
        morph_block = (
            f"  plural: {parent_morphology.plural_marker or '(none)'}\n"
            f"  honorific: {parent_morphology.honorific_prefix or '(none)'}\n"
            f"  place-name suffix: {parent_morphology.place_name_suffix or '(none)'}\n"
            f"  diminutive: {parent_morphology.diminutive or '(none)'}\n"
        )
    return f"""World: "{world_name}"
New era starting: "{new_era_name}" (in-world year {new_era_year})

PARENT ERA LEXICON (drift FROM these):
{parent_block or "(no parent — this is the founding lexicon)"}

PARENT ERA PHONOLOGY NOTES:
{parent_phonology or "(none)"}

PARENT ERA MORPHOLOGY:
{morph_block or "(none)"}

Produce the new era's linguistic snapshot. Keep continuity — most words drift
slightly, a few replace entirely, some new concepts get coined.

Return JSON:
{{
  "phonology_notes": "1-2 sentence prose summary (e.g. 'fricatives soften, /θ/ → /s/; final vowels nasalise')",
  "phonological_rules": [
    {{"from_sound": "/θ/", "to_sound": "/s/", "context": "word-initial"}},
    {{"from_sound": "/r/", "to_sound": "/ɾ/", "context": "intervocalic"}}
  ],
  "morphology": {{
    "plural_marker": "-ar suffix on nouns",
    "honorific_prefix": "ael- before names of nobility",
    "place_name_suffix": "-vael (sacred sites), -korr (battlefields)",
    "diminutive": "-ik (affectionate)",
    "notes": "verbs gain agglutinative tense markers"
  }},
  "sample_lexicon": {{
    "moon": "vael",
    "queen": "aelin"
  }},
  "sample_text": "one paragraph (40-80 words) of in-world prose IN THE NEW ERA'S DIALECT — evocative, no translation",
  "inscriptions": [
    {{"in_world_text": "Aelin-vael, kor-thar moren.", "translation": "Queen of the moon, who held the long dark.", "context": "gravestone fragment, third generation"}},
    {{"in_world_text": "Sael-korr morenith.", "translation": "Salt-field of the fallen.", "context": "battle banner"}}
  ]
}}

Constraints:
- 2-5 phonological_rules. Each describes ONE shift; cite a context (word-initial, intervocalic, before-vowel, final, etc.).
- Morphology fields may be empty if the era didn't innovate that feature.
- 20-30 lexicon entries. Drift them, don't invent unrelated words. Maintain a recognizable lineage from parent.
- 2-4 inscriptions. Each tells a tiny story (epitaph, vow, oath, edict)."""


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


def _coerce_rules(raw_rules) -> list[PhonologicalRule]:
    """Best-effort parse of LLM-emitted phonological_rules — drop malformed entries."""
    if not isinstance(raw_rules, list):
        return []
    out: list[PhonologicalRule] = []
    for r in raw_rules[:8]:  # cap so a runaway LLM can't bloat the model
        if not isinstance(r, dict):
            continue
        out.append(PhonologicalRule(
            from_sound=str(r.get("from_sound") or r.get("from") or "")[:60],
            to_sound=str(r.get("to_sound") or r.get("to") or "")[:60],
            context=str(r.get("context", "") or "")[:120],
        ))
    return [r for r in out if r.from_sound and r.to_sound]


def _coerce_morphology(raw_morph) -> Morphology:
    if not isinstance(raw_morph, dict):
        return Morphology()
    return Morphology(
        plural_marker=str(raw_morph.get("plural_marker", "") or "")[:120],
        honorific_prefix=str(raw_morph.get("honorific_prefix", "") or "")[:120],
        place_name_suffix=str(raw_morph.get("place_name_suffix", "") or "")[:160],
        diminutive=str(raw_morph.get("diminutive", "") or "")[:120],
        notes=str(raw_morph.get("notes", "") or "")[:240],
    )


def _coerce_inscriptions(raw_ins) -> list[Inscription]:
    if not isinstance(raw_ins, list):
        return []
    out: list[Inscription] = []
    for i in raw_ins[:6]:
        if not isinstance(i, dict):
            continue
        out.append(Inscription(
            in_world_text=str(i.get("in_world_text", "") or "")[:240],
            translation=str(i.get("translation", "") or "")[:300],
            context=str(i.get("context", "") or "")[:120],
        ))
    return [i for i in out if i.in_world_text]


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
    parent_morph = parent.morphology if parent else None
    raw = await chat_completion(
        system=_LINGUISTIC_SYSTEM,
        user=_drift_prompt(world_name, new_era_name, new_era_year, parent_lex, parent_phon, parent_morph),
        temperature=0.85,
        max_tokens=1800,
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
        phonological_rules=_coerce_rules(data.get("phonological_rules")),
        morphology=_coerce_morphology(data.get("morphology")),
        sample_lexicon=dict(data.get("sample_lexicon", {}) or {}),
        sample_text=str(data.get("sample_text", "") or "")[:1200],
        inscriptions=_coerce_inscriptions(data.get("inscriptions")),
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
            morph_bits = []
            if le.morphology.plural_marker:
                morph_bits.append(f"plural: {le.morphology.plural_marker}")
            if le.morphology.honorific_prefix:
                morph_bits.append(f"honorific: {le.morphology.honorific_prefix}")
            if le.morphology.place_name_suffix:
                morph_bits.append(f"place-name: {le.morphology.place_name_suffix}")
            morph_block = ("\nMorphology hints: " + "; ".join(morph_bits)) if morph_bits else ""
            return f"Era voice: {le.phonology_notes}\nKey terms: {lex_block}{morph_block}\nSample: {le.sample_text}"
    return ""
