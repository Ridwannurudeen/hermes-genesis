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
from datetime import datetime

from llm import chat_completion, extract_json
from chroniclon import store
from chroniclon.article_writer import write_article
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

logger = logging.getLogger(__name__)


async def decide_canonization(
    *,
    world_name: str,
    era_name: str,
    in_world_year: int,
    event: dict,
    recent_titles: list[str],
) -> dict:
    raw = await chat_completion(
        system=CANON_AGENT_SYSTEM,
        user=canon_decision_prompt(world_name, era_name, in_world_year, event, recent_titles),
        temperature=0.3,
        max_tokens=600,
        provider="nous",
    )
    try:
        data = extract_json(raw)
        if isinstance(data, list):
            return {"canonize": False, "reasoning": "parse-list-fallback"}
        return data
    except Exception as e:
        logger.warning(f"canon decide parse failed: {e}")
        return {"canonize": False, "reasoning": "parse-failure"}


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
) -> WikiArticle | None:
    """Run the full canonization pipeline for one simulation event.
    Returns the persisted WikiArticle if canonized, None if skipped.

    writer_provider controls which model writes the article body. Defaults
    to Kimi K2.6 for the canon path; regen demos can pass 'nous' to keep
    Kimi spend bounded.
    """

    recent_rows = store.list_articles(limit=20)
    recent_titles = [r["title"] for r in recent_rows]

    decision = await decide_canonization(
        world_name=world_name,
        era_name=era_name,
        in_world_year=in_world_year,
        event=event,
        recent_titles=recent_titles,
    )

    if not decision.get("canonize"):
        logger.info(f"skip canonize: {event.get('title','?')} — {decision.get('reasoning','')}")
        return None

    title = decision.get("title") or event.get("title") or "Untitled"
    kind = decision.get("kind") or "event"
    voice = decision.get("voice") or "scholarly"
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
        provider=writer_provider,
    )

    # Adversarial pass
    canon_facts = _canon_facts_for(era_id)
    slop = await antislop_score(article.body_md)
    fact = await factcheck_score(article.body_md, canon_facts)

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
    if links:
        article.body_md = apply_crosslinks(article.body_md, links)
        # refresh backlinks
        from chroniclon.article_writer import _extract_backlinks, _word_count
        article.backlinks = _extract_backlinks(article.body_md)
        article.word_count = _word_count(article.body_md)

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
    return article
