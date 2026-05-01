"""Article-level hero image generation for the Chroniclon wiki.

Distinct from `backend/image_gen.py`'s per-event scene cache used by Cinematic
Mode:
  - Persistent (one image per article slug, kept forever)
  - Era-art-style grounded (every era has its own visual register taken from
    the LLM-generated `Era.art_style` field)
  - Character-grounded (the lead character's genome shapes the subject)
  - Stored under data/chroniclon/images/{slug}.webp
  - Updates `article.illustration_url`

We intentionally don't reuse the SCENE_PROMPTS templates from `image_gen.py`:
those are event-type stereotypes ("Epic fantasy battle scene…") that produce
the same image regardless of which world we're in. Chroniclon images need
to *look* different per era — that's the whole point of `Era.art_style`.
"""
from __future__ import annotations

import base64
import logging
import re
from pathlib import Path

import httpx

from config import (
    CHRONICLON_DIR,
    IMAGE_API_KEY,
    IMAGE_API_URL,
    IMAGE_MODEL,
)

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
#  Subject framing                                                             #
# --------------------------------------------------------------------------- #

# Per-article-kind subject framing. The framing word picks composition;
# everything else (style, character) is layered on by the prompt builder.
_SUBJECT_FRAMING: dict[str, str] = {
    "person": "intimate portrait, shoulders up, three-quarter view",
    "place": "wide establishing shot of the location, atmospheric",
    "faction": "banner and emblem on weathered stone, faction colors muted",
    "artifact": "single sacred object on a still surface, soft light",
    "language": "scribed manuscript page, close detail, ink and parchment",
    "concept": "allegorical illustration, symbolic, no figures",
    "prophecy": "celestial sign in the sky, mythic register, sparse landscape",
    "event": "moment frozen mid-action, theatrical staging, narrative weight",
}


def _genome_descriptor(genome: dict | None) -> str:
    """Translate the 6-trait genome into one short visual descriptor.
    Mirrors the archetype mapping in `chroniclon.voices` so audio + image
    portray the same person consistently."""
    if not genome:
        return ""
    courage = float(genome.get("courage", 0.5))
    cunning = float(genome.get("cunning", 0.5))
    loyalty = float(genome.get("loyalty", 0.5))
    ambition = float(genome.get("ambition", 0.5))
    empathy = float(genome.get("empathy", 0.5))
    resilience = float(genome.get("resilience", 0.5))

    if courage > 0.7 and resilience > 0.6:
        return "scarred warrior, shoulders set, eyes hard, weathered armor"
    if cunning > 0.7 and ambition > 0.6:
        return "watchful schemer, half-shadowed, faint smile, fine cloth"
    if empathy > 0.7 and loyalty > 0.6:
        return "gentle elder, weathered hands, kind brow, simple garments"
    if cunning > 0.6 and empathy < 0.4:
        return "ascetic mystic, hooded, distant gaze, ritual marks"
    if ambition > 0.7:
        return "sharp-featured noble, upright bearing, fine cloth, restless eyes"
    return "solitary figure, ambiguous posture, plain robes"


def build_prompt(
    *,
    kind: str,
    title: str,
    era_art_style: str | None,
    character: dict | None = None,
) -> str:
    """Compose the FLUX prompt. Pure — easy to unit-test."""
    framing = _SUBJECT_FRAMING.get(kind, "moment frozen mid-action, theatrical staging")
    style = (era_art_style or "hand-illuminated manuscript, parchment tones, ink wash").strip()
    style = style[:280]  # bound prompt size
    parts: list[str] = [
        f"{framing} — for the wiki article '{title}'.",
    ]
    if character:
        name = (character.get("name") or "").strip()
        role = (character.get("role") or "").strip()
        descriptor = _genome_descriptor(character.get("genome"))
        if name or role or descriptor:
            who = f"Featured: {name}" if name else "Featured subject"
            if role:
                who += f", {role}"
            if descriptor:
                who += f" — {descriptor}"
            who += "."
            parts.append(who)
    parts.append(f"Art style: {style}.")
    parts.append("Cinematic, painterly, no text, no words, no letters, no watermarks, no UI.")
    return " ".join(parts)


# --------------------------------------------------------------------------- #
#  Persistence                                                                 #
# --------------------------------------------------------------------------- #

def is_configured() -> bool:
    return bool(IMAGE_API_KEY)


def _safe_slug(slug: str) -> str:
    return re.sub(r"[^a-z0-9\-]", "", (slug or "").lower())


def slug_image_path(slug: str) -> Path:
    return Path(CHRONICLON_DIR) / "images" / f"{_safe_slug(slug)}.webp"


# --------------------------------------------------------------------------- #
#  Render                                                                      #
# --------------------------------------------------------------------------- #

async def render_article_image(
    *,
    slug: str,
    kind: str,
    title: str,
    era_art_style: str | None,
    character: dict | None = None,
) -> dict:
    """Render one hero image for an article. Returns metadata; does NOT update
    the article record (the caller does that). Idempotent — overwrites."""
    if not is_configured():
        raise RuntimeError("IMAGE_API_KEY not set — image rendering disabled")
    safe = _safe_slug(slug)
    if not safe:
        raise ValueError("invalid slug")

    prompt = build_prompt(
        kind=kind,
        title=title,
        era_art_style=era_art_style,
        character=character,
    )
    target = slug_image_path(safe)
    target.parent.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            f"{IMAGE_API_URL}/images/generations",
            headers={
                "Authorization": f"Bearer {IMAGE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": IMAGE_MODEL,
                "prompt": prompt,
                "width": 1024,
                "height": 768,
                "steps": 8,
                "n": 1,
                "response_format": "b64_json",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    try:
        b64_data = data["data"][0]["b64_json"]
    except (KeyError, IndexError) as ex:
        raise RuntimeError(f"image API returned unexpected payload: {ex}")

    target.write_bytes(base64.b64decode(b64_data))
    logger.info(f"rendered article image: {target} ({target.stat().st_size} bytes)")

    return {
        "slug": safe,
        "path": str(target),
        "url": f"/api/chronicle/images/{safe}",
        "prompt": prompt[:240],
        "byte_size": target.stat().st_size,
    }


# --------------------------------------------------------------------------- #
#  CLI — single + batch retrofit                                               #
# --------------------------------------------------------------------------- #

async def _retrofit_all(skip_existing: bool = True, limit: int | None = None) -> dict:
    """Walk every persisted article and render an image for any without one.
    Used after deploying the auto-render hook so the existing canon gets
    visuals without waiting for fresh canonization."""
    from chroniclon import store

    rows = store.list_articles(limit=limit or 10_000)
    rendered, skipped, failed = 0, 0, 0
    for r in rows:
        slug = r["slug"]
        a = store.load_article_by_slug(slug)
        if a is None:
            failed += 1
            continue
        if skip_existing and getattr(a, "illustration_url", None):
            skipped += 1
            continue
        # Look up era + character context.
        era = next((e for e in store.list_eras() if e.era_id == a.era_id), None)
        art_style = (getattr(era, "art_style", "") or "") if era else ""
        try:
            result = await render_article_image(
                slug=slug,
                kind=a.kind,
                title=a.title,
                era_art_style=art_style,
                character=None,  # retrofit has no character context
            )
            a.illustration_url = result["url"]
            store.save_article(a)
            rendered += 1
        except Exception as ex:  # noqa: BLE001
            logger.warning(f"image render failed for {slug}: {ex}")
            failed += 1
    return {"rendered": rendered, "skipped": skipped, "failed": failed, "total": len(rows)}


def _showcase_score(row: dict) -> float:
    """Higher = better demo candidate. Tuned to favor articles that already
    have audio (so adding image makes them a complete multimedia showcase)
    and Kimi-written canon (Kimi-track proof on the page judges land on).
    Returns a negative score for already-illustrated articles so they sink
    to the bottom of the queue."""
    score = 0.0
    score += float(row.get("word_count") or 0)
    if row.get("audio_url"):
        # Big bump: audio + image is the pair that makes a demo "complete".
        score += 1200.0
    writer = (row.get("writer_label") or row.get("writer_provider") or "").lower()
    if "kimi" in writer:
        # Kimi-track proof — surface these on judge-facing pages.
        score += 600.0
    if row.get("anti_slop_score") is not None:
        score += float(row.get("anti_slop_score") or 0) * 200.0
    if row.get("illustration_url"):
        # Already illustrated — push to the bottom.
        score -= 10_000.0
    return score


async def _render_showcase(n: int = 3, force: bool = False) -> dict:
    """Render hero images for the top-N most demo-worthy articles.

    Selection: highest showcase_score, deduped per (era, kind) so the showcase
    is visually diverse. Used pre-recording so the article-detail pages judges
    will land on are guaranteed to have hero art — not at the mercy of which
    canon happens to have been rendered.
    """
    from chroniclon import store

    rows = store.list_articles(limit=10_000)
    if not rows:
        return {"rendered": 0, "skipped": 0, "failed": 0, "selected": 0, "total": 0}

    ranked = sorted(rows, key=_showcase_score, reverse=True)
    seen_buckets: set[tuple[str, str]] = set()
    chosen: list[dict] = []
    for r in ranked:
        if not force and r.get("illustration_url"):
            continue
        bucket = (str(r.get("era_id") or ""), str(r.get("kind") or ""))
        if bucket in seen_buckets:
            continue
        seen_buckets.add(bucket)
        chosen.append(r)
        if len(chosen) >= n:
            break

    rendered, failed = 0, 0
    for r in chosen:
        slug = r["slug"]
        a = store.load_article_by_slug(slug)
        if a is None:
            failed += 1
            continue
        era = next((e for e in store.list_eras() if e.era_id == a.era_id), None)
        art_style = (getattr(era, "art_style", "") or "") if era else ""
        try:
            result = await render_article_image(
                slug=slug,
                kind=a.kind,
                title=a.title,
                era_art_style=art_style,
                character=None,
            )
            a.illustration_url = result["url"]
            store.save_article(a)
            rendered += 1
            logger.info(f"showcase rendered: {slug} ({a.title[:60]})")
        except Exception as ex:  # noqa: BLE001
            logger.warning(f"showcase render failed for {slug}: {ex}")
            failed += 1
    return {
        "rendered": rendered,
        "skipped": 0,
        "failed": failed,
        "selected": len(chosen),
        "total": len(rows),
    }


def main() -> None:
    """CLI entry: render a single article's image, or batch-retrofit all."""
    import argparse
    import asyncio
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        stream=sys.stdout,
    )
    parser = argparse.ArgumentParser(description="Render a wiki article hero image.")
    parser.add_argument("--slug", help="article slug (single-render mode)")
    parser.add_argument("--all", action="store_true", help="batch-render every article missing an image")
    parser.add_argument("--showcase", type=int, default=0, metavar="N",
                        help="render the N most demo-worthy articles (era/kind diverse)")
    parser.add_argument("--limit", type=int, default=None, help="cap how many to process in --all mode")
    parser.add_argument("--force", action="store_true", help="re-render even if illustration_url already exists")
    args = parser.parse_args()

    if args.showcase > 0:
        result = asyncio.run(_render_showcase(n=args.showcase, force=args.force))
        print(f"\nDONE (showcase): rendered={result['rendered']} failed={result['failed']} selected={result['selected']} (total={result['total']})")
        return

    if args.all:
        result = asyncio.run(_retrofit_all(skip_existing=not args.force, limit=args.limit))
        print(f"\nDONE: rendered={result['rendered']} skipped={result['skipped']} failed={result['failed']} (total={result['total']})")
        return

    if not args.slug:
        parser.error("Provide --slug <slug> for single-render, or --all to retrofit the canon.")

    from chroniclon import store as _store

    article = _store.load_article_by_slug(args.slug)
    if article is None:
        raise SystemExit(f"article not found: {args.slug}")
    era = next((e for e in _store.list_eras() if e.era_id == article.era_id), None)
    art_style = (getattr(era, "art_style", "") or "") if era else ""
    result = asyncio.run(
        render_article_image(
            slug=args.slug,
            kind=article.kind,
            title=article.title,
            era_art_style=art_style,
            character=None,
        )
    )
    article.illustration_url = result["url"]
    _store.save_article(article)
    print(f"\nDONE: {result['slug']}\n  bytes: {result['byte_size']}\n  url:   {result['url']}\n  file:  {result['path']}\n  prompt: {result['prompt']}")


if __name__ == "__main__":
    main()
