"""Long-form article generation. Kimi K2.6 writes; Hermes critics judge."""
import logging
import re
import uuid
from datetime import datetime

from llm import chat_completion
from chroniclon.models import WikiArticle
from chroniclon.prompts import (
    ARTICLE_WRITER_SYSTEM,
    article_writer_prompt,
)

logger = logging.getLogger(__name__)


def _slugify(title: str) -> str:
    s = title.lower().strip()
    s = re.sub(r"[^a-z0-9\s\-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:80] or f"article-{uuid.uuid4().hex[:8]}"


def _word_count(md: str) -> int:
    text = re.sub(r"`{1,3}[^`]*`{1,3}", " ", md)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    return len([w for w in re.split(r"\s+", text) if w.strip()])


def _extract_backlinks(md: str) -> list[str]:
    return list({m.group(1).strip() for m in re.finditer(r"\[\[([a-z0-9\-]+)\]\]", md)})


async def write_article(
    *,
    world_name: str,
    seed: str,
    era_id: str,
    era_name: str,
    in_world_year: int,
    title: str,
    kind: str,
    voice: str,
    word_count_target: int,
    event: dict | None,
    related_articles: list[dict],
    linguistic_notes: str = "",
    canon_excerpts: list[str] | None = None,
    contributor: str | None = None,
    provider: str = "kimi",
) -> WikiArticle:
    """Generate one long-form article. Default is Kimi K2.6 for the canon
    path (long-context cross-article continuity); regen demos can pass
    provider='nous' to save budget on throwaway content.
    """
    prompt = article_writer_prompt(
        world_name=world_name,
        seed=seed,
        era_name=era_name,
        in_world_year=in_world_year,
        title=title,
        kind=kind,
        voice=voice,
        word_count_target=word_count_target,
        event=event,
        related_articles=related_articles,
        linguistic_notes=linguistic_notes,
        canon_excerpts=canon_excerpts,
    )

    # Token budget — generous so reasoning models leave room for content
    max_tokens = min(int(word_count_target * 1.8) + 400, 12000)

    body = await chat_completion(
        system=ARTICLE_WRITER_SYSTEM,
        user=prompt,
        temperature=0.85,
        max_tokens=max_tokens,
        provider=provider,
    )

    body = body.strip()
    # Strip any accidental markdown fence wrap
    if body.startswith("```"):
        body = body.split("\n", 1)[-1]
        if body.endswith("```"):
            body = body.rsplit("```", 1)[0].strip()

    article_id = f"art_{uuid.uuid4().hex[:12]}"
    slug = _slugify(title)

    return WikiArticle(
        article_id=article_id,
        slug=slug,
        title=title,
        kind=kind,  # type: ignore[arg-type]
        era_id=era_id,
        in_world_year=in_world_year,
        voice=voice,  # type: ignore[arg-type]
        body_md=body,
        word_count=_word_count(body),
        backlinks=_extract_backlinks(body),
        contributor=contributor,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
