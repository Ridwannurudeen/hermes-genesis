"""Canon agent — the orchestrator that turns simulation events into wiki articles.

Pipeline per event:
  1. Hermes decides if it's article-worthy + picks kind/voice/title
  2. Kimi writes the article (long-form)
  3. Hermes runs anti-slop + fact-check critics
  4. If below threshold, one revision pass
  5. Hermes proposes cross-links to existing articles
  6. Persist article + update related articles' inbound list

Runs once per accepted simulation tick. Skip-rate is intentional: not every
event becomes an article. Pivotal events do.
"""
import logging
import random
import uuid
from collections import Counter
from datetime import datetime


def uuid_hex_short() -> str:
    """Short, sortable-enough id for Control Room pipeline correlation."""
    return uuid.uuid4().hex[:10]


# Five legal voice tones. Ordered by approximate baseline frequency we'd want
# in a healthy canon — heavier on registers that appear less often in practice.
_VOICE_POOL = ["scholarly", "newspaper", "court", "diary", "scripture"]
_VOICE_WEIGHTS = [0.25, 0.25, 0.20, 0.18, 0.12]


def _diversity_hint(recent_articles: list[dict]) -> str:
    """Build a one-line nudge for the canon decision prompt when recent
    coverage is overweight on any voice. Keeps article output texturally
    varied without overriding the LLM's editorial judgment."""
    if not recent_articles:
        return ""
    voices = [a.get("voice") or "" for a in recent_articles[-12:] if a.get("voice")]
    if not voices:
        return ""
    counts = Counter(voices)
    dominant, n = counts.most_common(1)[0]
    if n / len(voices) < 0.55:
        return ""  # already diverse enough
    alternatives = [v for v in _VOICE_POOL if v != dominant]
    suggestion = ", ".join(alternatives[:3])
    return (
        f"\nNOTE: recent canon is heavy on '{dominant}' voice "
        f"({n}/{len(voices)} of last entries). Reach for a different register "
        f"({suggestion}) unless this event clearly demands '{dominant}'."
    )


def _pick_fallback_voice() -> str:
    """Weighted-random voice for when the LLM's decision JSON is malformed
    and we must fill in. Better than always defaulting to 'scholarly' —
    that's been the production drift cause."""
    return random.choices(_VOICE_POOL, weights=_VOICE_WEIGHTS, k=1)[0]

from llm import call_with_tool
from chroniclon import store
from chroniclon.article_writer import write_article
from chroniclon.control_stream import emit as _control_emit
from chroniclon.critics import (
    antislop_score,
    factcheck_score,
    crosslink_propose,
    apply_crosslinks,
    ANTISLOP_REVISE_THRESHOLD,
    FACTCHECK_REVISE_THRESHOLD,
)
from chroniclon.models import WikiArticle
from chroniclon.prompts import CANON_AGENT_SYSTEM, canon_decision_prompt


# Friendly model labels for the Control Room — purely cosmetic but consistent.
_HERMES_LABEL = "Hermes-4-70B"
_KIMI_LABEL = "Kimi-K2.6"


def _writer_label(provider: str) -> str:
    return _KIMI_LABEL if provider == "kimi" else _HERMES_LABEL

logger = logging.getLogger(__name__)


_CANON_DECISION_SCHEMA = {
    "type": "object",
    "properties": {
        "canonize": {
            "type": "boolean",
            "description": "True if this event deserves its own primary-source article.",
        },
        "kind": {
            "type": "string",
            "enum": ["event", "person", "faction", "place", "language", "concept", "artifact", "prophecy"],
        },
        "voice": {
            "type": "string",
            "enum": ["scholarly", "diary", "newspaper", "scripture", "court"],
            "description": "Source-of-record register for the article.",
        },
        "title": {"type": "string", "description": "In-world, evocative, no spoilers."},
        "word_count_target": {
            "type": "integer",
            "description": "300 brief, 1200 standard, 4000 pivotal.",
        },
        "related": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Up to 4 slugs of prior articles to cross-link.",
        },
        "reasoning": {"type": "string", "description": "1 sentence justification."},
    },
    "required": ["canonize"],
}


async def decide_canonization(
    *,
    world_name: str,
    era_name: str,
    in_world_year: int,
    event: dict,
    recent_titles: list[str],
    diversity_hint: str = "",
) -> dict:
    user_prompt = canon_decision_prompt(world_name, era_name, in_world_year, event, recent_titles)
    if diversity_hint:
        user_prompt = user_prompt + diversity_hint
    data = await call_with_tool(
        system=CANON_AGENT_SYSTEM,
        user=user_prompt,
        tool_name="submit_canon_decision",
        tool_description="Submit the canon agent's decision for this event.",
        parameters_schema=_CANON_DECISION_SCHEMA,
        temperature=0.3,
        max_tokens=700,
        provider="nous",
    )
    if not data:
        return {"canonize": False, "reasoning": "no-tool-call"}
    return data


def _canon_facts_for(era_id: str, limit: int = 30) -> list[str]:
    """Build a brief list of canonical facts: titles + first-sentence summaries
    from existing articles in this era. Cheap, sufficient for fact-check pass."""
    rows = store.list_articles(era_id=era_id, limit=limit)
    facts: list[str] = []
    for r in rows:
        a = store.load_article(r["article_id"])
        if not a:
            continue
        # First sentence after the # title line
        body = a.body_md
        lines = [ln.strip() for ln in body.split("\n") if ln.strip() and not ln.strip().startswith("#")]
        first = lines[0] if lines else ""
        first = first.split(". ")[0][:240]
        facts.append(f"{a.title} ({a.kind}, year {a.in_world_year}): {first}")
    return facts


_AUDIENCE_MODERATION_SYSTEM = """You are the canon-keeper of a fictional civilization
welcoming audience contributions. A viewer has submitted a sentence-or-two event
they think should join the canon. Your job is to:
  (1) decide whether it can be accepted
  (2) if yes, synthesize a structured Event we can canonize

Reject when the seed is:
  - real-world references (modern brands, current politics, real names)
  - safety violations (slurs, sexual content, doxx, instructions for harm)
  - flat contradictions of established canon (a dead character returns, etc.)
  - off-genre noise that breaks immersion

Accept when the seed is in-world, novel, and consistent with the era's mood.

Output STRICT JSON ONLY."""


def _audience_moderation_prompt(
    seed_text: str,
    world_name: str,
    world_seed: str,
    era_name: str,
    era_summary: str,
    in_world_year: int,
    recent_titles: list[str],
) -> str:
    titles_block = "\n".join(f"- {t}" for t in recent_titles[-12:]) or "(none yet)"
    return f"""World: "{world_name}"
World seed: "{world_seed}"
Current era: "{era_name}" — {era_summary or "(no summary yet)"}
In-world year: {in_world_year}

Recent canonized titles (avoid contradicting these):
{titles_block}

AUDIENCE SUBMISSION (verbatim):
\"\"\"{seed_text}\"\"\"

Decide:
{{
  "accept": true,
  "reasoning": "1 sentence",
  "event": {{
    "type": "battle | discovery | succession | omen | famine | edict | rite | misc",
    "title": "≤80 chars, in-world wording",
    "narrative": "1-3 sentence in-world prose, third person, present-or-past",
    "kind_hint": "event | person | place | concept | prophecy",
    "voice_hint": "scholarly | newspaper | court | diary | scripture"
  }}
}}

If you reject, set "accept": false, give "reasoning", and omit "event".
The "title" and "narrative" you produce will be the seed Kimi rewrites into the
final article — they should already feel like in-canon prose."""


async def moderate_and_synthesize_submission(
    *,
    seed_text: str,
    world_name: str,
    world_seed: str,
    era_name: str,
    era_summary: str,
    in_world_year: int,
) -> dict:
    """Hermes moderation gate for audience submissions. Returns:
      {accept: True, event: {...}, reasoning: str}
      {accept: False, reasoning: str}
    """
    from llm import chat_completion, extract_json

    recent = [r["title"] for r in store.list_articles(limit=12)]
    raw = await chat_completion(
        system=_AUDIENCE_MODERATION_SYSTEM,
        user=_audience_moderation_prompt(
            seed_text, world_name, world_seed, era_name, era_summary, in_world_year, recent,
        ),
        temperature=0.3,
        max_tokens=600,
        provider="nous",
    )
    try:
        data = extract_json(raw)
        if not isinstance(data, dict):
            return {"accept": False, "reasoning": "moderator returned non-object"}
    except Exception as e:
        logger.warning(f"audience moderation parse failed: {e}")
        return {"accept": False, "reasoning": "moderator output unparseable"}

    if not data.get("accept"):
        return {"accept": False, "reasoning": str(data.get("reasoning", "rejected"))[:240]}

    ev = data.get("event")
    if not isinstance(ev, dict) or not ev.get("title") or not ev.get("narrative"):
        return {"accept": False, "reasoning": "moderator approved but produced no event payload"}

    return {
        "accept": True,
        "reasoning": str(data.get("reasoning", ""))[:240],
        "event": {
            "type": str(ev.get("type", "misc"))[:32],
            "title": str(ev.get("title", ""))[:120],
            "narrative": str(ev.get("narrative", ""))[:1200],
            "kind_hint": str(ev.get("kind_hint", "event"))[:32],
            "voice_hint": str(ev.get("voice_hint", "scholarly"))[:32],
        },
    }


async def canonize_event(
    *,
    world_name: str,
    seed: str,
    era_id: str,
    era_name: str,
    in_world_year: int,
    event: dict,
    linguistic_notes: str = "",
    canon_excerpts: list[str] | None = None,
    writer_provider: str = "kimi",
    lead_character: dict | None = None,
    era_art_style: str = "",
    world_id: str | None = None,
    contributor: str | None = None,
) -> WikiArticle | None:
    """Run the full canonization pipeline for one simulation event.
    Returns the persisted WikiArticle if canonized, None if skipped.

    writer_provider controls which model writes the article body. Defaults
    to Kimi K2.6 for the canon path; regen demos can pass 'nous' to keep
    Kimi spend bounded.
    """

    recent_rows = store.list_articles(limit=20)
    recent_titles = [r["title"] for r in recent_rows]
    diversity_hint = _diversity_hint(recent_rows)

    pipeline_id = f"pl_{uuid_hex_short()}"
    event_title = event.get("title", "?")

    _control_emit({
        "phase": "decision_started",
        "pipeline_id": pipeline_id,
        "model": _HERMES_LABEL,
        "stage": "canon decision",
        "event_title": event_title,
        "event_type": event.get("type", ""),
        "era_name": era_name,
        "in_world_year": in_world_year,
    })

    decision = await decide_canonization(
        world_name=world_name,
        era_name=era_name,
        in_world_year=in_world_year,
        event=event,
        recent_titles=recent_titles,
        diversity_hint=diversity_hint,
    )

    if not decision.get("canonize"):
        logger.info(f"skip canonize: {event.get('title','?')} — {decision.get('reasoning','')}")
        _control_emit({
            "phase": "skipped",
            "pipeline_id": pipeline_id,
            "model": _HERMES_LABEL,
            "stage": "canon decision",
            "event_title": event_title,
            "reasoning": str(decision.get("reasoning", ""))[:240],
        })
        return None

    _control_emit({
        "phase": "decision_complete",
        "pipeline_id": pipeline_id,
        "model": _HERMES_LABEL,
        "stage": "canon decision",
        "event_title": event_title,
        "decision": {
            "kind": decision.get("kind"),
            "voice": decision.get("voice"),
            "title": decision.get("title"),
            "word_count_target": decision.get("word_count_target"),
        },
    })

    title = decision.get("title") or event.get("title") or "Untitled"
    kind = decision.get("kind") or "event"
    voice = decision.get("voice") or _pick_fallback_voice()
    target = int(decision.get("word_count_target") or 1200)

    related_slugs = decision.get("related") or []
    related_articles: list[dict] = []
    for slug in related_slugs[:6]:
        a = store.load_article_by_slug(slug)
        if a:
            related_articles.append({
                "slug": a.slug,
                "title": a.title,
                "kind": a.kind,
                "in_world_year": a.in_world_year,
            })

    _control_emit({
        "phase": "writing_started",
        "pipeline_id": pipeline_id,
        "model": _writer_label(writer_provider),
        "stage": "long-form prose",
        "event_title": event_title,
        "title": title,
        "voice": voice,
        "kind": kind,
        "word_count_target": target,
    })

    article = await write_article(
        world_name=world_name,
        seed=seed,
        era_id=era_id,
        era_name=era_name,
        in_world_year=in_world_year,
        title=title,
        kind=kind,
        voice=voice,
        word_count_target=target,
        event=event,
        related_articles=related_articles,
        linguistic_notes=linguistic_notes,
        canon_excerpts=canon_excerpts,
        contributor=contributor,
        provider=writer_provider,
    )

    _control_emit({
        "phase": "writing_complete",
        "pipeline_id": pipeline_id,
        "model": _writer_label(writer_provider),
        "stage": "long-form prose",
        "title": title,
        "word_count": article.word_count,
        "voice": voice,
    })

    # Adversarial pass
    canon_facts = _canon_facts_for(era_id)
    slop = await antislop_score(article.body_md)
    _control_emit({
        "phase": "antislop_complete",
        "pipeline_id": pipeline_id,
        "model": _HERMES_LABEL,
        "stage": "anti-slop critic",
        "title": title,
        "score": slop["score"],
        "top_fix": (slop.get("top_fix") or "")[:200],
        "fourth_wall_breaks": len(slop.get("fourth_wall_breaks", []) or []),
    })
    fact = await factcheck_score(article.body_md, canon_facts)
    _control_emit({
        "phase": "factcheck_complete",
        "pipeline_id": pipeline_id,
        "model": _HERMES_LABEL,
        "stage": "fact-check critic",
        "title": title,
        "score": fact["score"],
        "verdict": fact.get("verdict", "approve"),
        "contradictions": len(fact.get("contradictions", []) or []),
    })

    article.anti_slop_score = slop["score"]
    article.fact_check_score = fact["score"]
    article.critic_passes = 1

    # Revision is expensive (full second Kimi call). Only fire on real quality
    # failures. The fourth-wall flag is folded into the slop score by the critic;
    # we don't separately revise on it (was over-firing in early runs).
    needs_revision = (
        slop["score"] < ANTISLOP_REVISE_THRESHOLD
        or fact["score"] < FACTCHECK_REVISE_THRESHOLD
    )
    if needs_revision:
        _control_emit({
            "phase": "revision_started",
            "pipeline_id": pipeline_id,
            "model": _writer_label(writer_provider),
            "stage": "revision pass",
            "title": title,
            "reason_slop": slop["score"] < ANTISLOP_REVISE_THRESHOLD,
            "reason_fact": fact["score"] < FACTCHECK_REVISE_THRESHOLD,
        })
        revision_notes = []
        if slop["top_fix"]:
            revision_notes.append(f"Anti-slop: {slop['top_fix']}")
        if slop["fourth_wall_breaks"]:
            revision_notes.append("Remove fourth-wall breaks: " + "; ".join(slop["fourth_wall_breaks"]))
        if fact["contradictions"]:
            for c in fact["contradictions"][:3]:
                revision_notes.append(f"Fact: {c.get('claim','?')} conflicts with {c.get('conflicts_with','?')}")

        canon_excerpts = (canon_excerpts or []) + [
            "REVISION NOTES (apply these, then rewrite the article from scratch in the same voice):\n"
            + "\n".join(f"- {n}" for n in revision_notes)
        ]
        try:
            revised = await write_article(
                world_name=world_name,
                seed=seed,
                era_id=era_id,
                era_name=era_name,
                in_world_year=in_world_year,
                title=title,
                kind=kind,
                voice=voice,
                word_count_target=target,
                event=event,
                related_articles=related_articles,
                linguistic_notes=linguistic_notes,
                canon_excerpts=canon_excerpts,
                provider=writer_provider,
            )
            # Re-score
            slop2 = await antislop_score(revised.body_md)
            fact2 = await factcheck_score(revised.body_md, canon_facts)
            # Keep whichever is better on combined score
            combined_orig = (article.anti_slop_score or 0) + (article.fact_check_score or 0)
            combined_new = slop2["score"] + fact2["score"]
            if combined_new > combined_orig:
                article = revised
                article.anti_slop_score = slop2["score"]
                article.fact_check_score = fact2["score"]
            article.critic_passes = 2
        except Exception as e:
            logger.warning(f"revision pass failed, keeping original: {e}")

    # Cross-link pass
    available = [
        {"slug": r["slug"], "title": r["title"]}
        for r in store.list_articles(limit=200)
    ]
    links = await crosslink_propose(article.body_md, available)
    _control_emit({
        "phase": "crosslinks_complete",
        "pipeline_id": pipeline_id,
        "model": _HERMES_LABEL,
        "stage": "cross-linker",
        "title": title,
        "links_proposed": len(links) if links else 0,
    })
    if links:
        article.body_md = apply_crosslinks(article.body_md, links)
        # refresh backlinks
        from chroniclon.article_writer import _extract_backlinks, _word_count
        article.backlinks = _extract_backlinks(article.body_md)
        article.word_count = _word_count(article.body_md)

    # Provenance: link the article back to the simulation event so the
    # Civilization Autopsy view can walk causation chains.
    article.source_event_id = event.get("id") or article.source_event_id
    article.source_world_id = world_id or event.get("world_id") or article.source_world_id
    article.updated_at = datetime.utcnow()
    store.save_article(article)

    # Update inbound on referenced articles
    for slug in article.backlinks:
        target_art = store.load_article_by_slug(slug)
        if target_art and article.slug not in target_art.inbound:
            target_art.inbound.append(article.slug)
            target_art.updated_at = datetime.utcnow()
            store.save_article(target_art)

    logger.info(f"canonized: [{kind}] {title} ({article.word_count} words, slop={slop['score']:.2f}, fact={fact['score']:.2f})")

    _control_emit({
        "phase": "published",
        "pipeline_id": pipeline_id,
        "model": _writer_label(writer_provider),
        "stage": "published",
        "slug": article.slug,
        "title": article.title,
        "kind": article.kind,
        "voice": article.voice,
        "word_count": article.word_count,
        "in_world_year": article.in_world_year,
        "anti_slop_score": article.anti_slop_score,
        "fact_check_score": article.fact_check_score,
        "critic_passes": article.critic_passes,
    })

    # Fire-and-forget media renders (audio + image). Both run in the background
    # so a slow TTS/FLUX call never blocks the canon pipeline. Both are
    # best-effort: missing API keys = no-op, render errors = warning + continue.
    import asyncio as _asyncio

    # ─── Audio chapter ────────────────────────────────────────────────
    try:
        from chroniclon.voices import is_configured as _tts_configured
        from chroniclon.audio_chapter import render_chapter as _render_audio
        if _tts_configured():
            genome = (lead_character or {}).get("genome") if lead_character else None

            async def _safe_audio(slug: str, g: dict | None) -> None:
                _control_emit({
                    "phase": "audio_started",
                    "pipeline_id": pipeline_id,
                    "model": "ElevenLabs / OpenAI TTS",
                    "stage": "audio chapter",
                    "slug": slug,
                })
                try:
                    result = await _render_audio(slug, lead_genome=g)
                    _control_emit({
                        "phase": "audio_complete",
                        "pipeline_id": pipeline_id,
                        "model": "ElevenLabs / OpenAI TTS",
                        "stage": "audio chapter",
                        "slug": slug,
                        "archetype": result.get("archetype"),
                        "audio_url": result.get("audio_url"),
                    })
                except Exception as ex:  # noqa: BLE001
                    logger.warning(f"audio render failed for {slug}: {ex}")
                    _control_emit({
                        "phase": "audio_failed",
                        "pipeline_id": pipeline_id,
                        "stage": "audio chapter",
                        "slug": slug,
                        "error": str(ex)[:200],
                    })

            _asyncio.create_task(_safe_audio(article.slug, genome))
    except Exception as ex:  # noqa: BLE001 — never block canonization on plumbing
        logger.debug(f"audio hook skipped: {ex}")

    # ─── Hero image ────────────────────────────────────────────────────
    try:
        from chroniclon.illustrations import is_configured as _img_configured
        from chroniclon.illustrations import render_article_image as _render_image
        if _img_configured():
            character = lead_character

            async def _safe_image(slug: str, kind: str, title: str, art_style: str, char: dict | None) -> None:
                _control_emit({
                    "phase": "image_started",
                    "pipeline_id": pipeline_id,
                    "model": "FLUX",
                    "stage": "hero image",
                    "slug": slug,
                })
                try:
                    result = await _render_image(
                        slug=slug,
                        kind=kind,
                        title=title,
                        era_art_style=art_style,
                        character=char,
                    )
                    # Update article record with the served URL — under the
                    # per-slug lock so we don't race the audio render.
                    async with store.article_lock_by_slug(slug):
                        persisted = store.load_article_by_slug(slug)
                        if persisted is not None:
                            persisted.illustration_url = result["url"]
                            persisted.updated_at = datetime.utcnow()
                            store.save_article(persisted)
                    _control_emit({
                        "phase": "image_complete",
                        "pipeline_id": pipeline_id,
                        "model": "FLUX",
                        "stage": "hero image",
                        "slug": slug,
                        "url": result["url"],
                        "byte_size": result.get("byte_size"),
                    })
                except Exception as ex:  # noqa: BLE001
                    logger.warning(f"image render failed for {slug}: {ex}")
                    _control_emit({
                        "phase": "image_failed",
                        "pipeline_id": pipeline_id,
                        "stage": "hero image",
                        "slug": slug,
                        "error": str(ex)[:200],
                    })

            _asyncio.create_task(_safe_image(article.slug, kind, title, era_art_style, character))
    except Exception as ex:  # noqa: BLE001
        logger.debug(f"image hook skipped: {ex}")

    return article
