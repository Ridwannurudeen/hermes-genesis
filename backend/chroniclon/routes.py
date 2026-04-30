"""FastAPI routes for the Chroniclon wiki.

Mounted at /api/chronicle/* by main.py.
"""
import asyncio
import html
import json
import os
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

import config
from auth import is_admin_credentials
from chroniclon import store
from chroniclon import control_stream
from chroniclon.models import WikiArticle
from chroniclon.regen import stream_regen


router = APIRouter(prefix="/api/chronicle", tags=["chronicle"])


def _chronicle_dir() -> Path:
    return Path(os.getenv("CHRONICLON_DIR") or config.CHRONICLON_DIR)


def require_admin(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    admin_session: str | None = Cookie(default=None, alias=config.ADMIN_SESSION_COOKIE),
) -> None:
    """Admin-only gate. When GENESIS_API_KEY is unset, treat as dev mode and allow.
    Reads config.API_KEY at call time so tests can rebind it cleanly."""
    if not is_admin_credentials(x_api_key, admin_session):
        raise HTTPException(status_code=403, detail="admin auth required")


# --------------------------------------------------------------------------- #
#  Stats / index                                                              #
# --------------------------------------------------------------------------- #

@router.get("/rss.xml")
async def rss_feed(request: Request) -> Response:
    """RSS 2.0 feed of the most-recent canonized articles. The single
    affordance that proves 'this is a real publication.'"""
    base = str(request.base_url).rstrip("/")
    rows = store.list_articles(limit=30)
    items = []
    for r in rows:
        slug = r["slug"]
        article = store.load_article_by_slug(slug)
        if article is None:
            continue
        # First 280 chars of body, stripped of crosslink markup, for description
        body = re.sub(r"\[\[([a-z0-9\-]+)\]\]", r"\1", article.body_md or "")
        body = re.sub(r"`{1,3}[^`]*`{1,3}", " ", body)
        body = re.sub(r"\*+", "", body)
        body = re.sub(r"\s+", " ", body).strip()
        description = body[:280] + ("…" if len(body) > 280 else "")
        # Use updated_at as pubDate; fallback to created_at
        ts = article.updated_at or article.created_at or datetime.now(timezone.utc)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        items.append({
            "title": html.escape(article.title),
            "link": f"{base}/chronicle/{slug}",
            "description": html.escape(description),
            "pub_date": format_datetime(ts),
            "guid": f"{base}/chronicle/{slug}",
            "category": article.kind,
            "year": article.in_world_year,
        })
    items_xml = "\n".join(
        f"""    <item>
      <title>{i['title']}</title>
      <link>{i['link']}</link>
      <guid isPermaLink=\"true\">{i['guid']}</guid>
      <pubDate>{i['pub_date']}</pubDate>
      <category>{i['category']}</category>
      <description>{i['description']}</description>
    </item>"""
        for i in items
    )
    now = format_datetime(datetime.now(timezone.utc))
    xml = f"""<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">
  <channel>
    <title>Chroniclon — A Wikipedia for a World That Doesn't Exist</title>
    <link>{base}</link>
    <atom:link href=\"{base}/api/chronicle/rss.xml\" rel=\"self\" type=\"application/rss+xml\" />
    <description>Autonomous canonization of fictional civilizations. Hermes-4-70B decides canon. Kimi-K2.6 writes it. The civilization keeps publishing.</description>
    <language>en</language>
    <lastBuildDate>{now}</lastBuildDate>
{items_xml}
  </channel>
</rss>
"""
    return Response(content=xml, media_type="application/rss+xml; charset=utf-8")


@router.get("/stats")
async def stats() -> dict:
    eras = store.list_eras()
    return {
        "article_count": store.article_count(),
        "total_words": store.total_word_count(),
        "era_count": len(eras),
        "current_era": eras[-1].name if eras else None,
        "linguistic_eras": len(store.list_linguistic_eras()),
        "contributor_count": store.contributor_count(),
    }


@router.get("/articles")
async def list_articles(
    era_id: str | None = None,
    kind: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return {"items": store.list_articles(era_id=era_id, kind=kind, limit=limit, offset=offset)}


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict:
    return {"items": store.search_articles(q, limit=limit), "query": q}


def _wrap_lines(text: str, max_chars: int, max_lines: int = 4) -> list[str]:
    """Cheap word-wrap for the SVG title. Doesn't measure glyph widths —
    falls back to char-count which is close enough for a 1200×630 card."""
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        candidate = f"{cur} {w}".strip() if cur else w
        if len(candidate) <= max_chars:
            cur = candidate
        else:
            if cur:
                lines.append(cur)
            cur = w
            if len(lines) >= max_lines - 1:
                break
    if cur:
        if len(lines) < max_lines:
            lines.append(cur)
    if len(lines) >= max_lines and len(text) > sum(len(l) + 1 for l in lines):
        lines[-1] = lines[-1].rstrip(" .,;:") + "…"
    return lines


@router.get("/og/{slug}.svg")
async def og_card(slug: str) -> Response:
    """Per-article OG card as inline SVG. 1200×630, editorial palette.
    SVG (rather than PNG) avoids bundling Pillow + serif font binaries; all
    modern social platforms (X, Discord, Slack, iMessage) render SVG og:image."""
    a = store.load_article_by_slug(slug)
    if not a:
        raise HTTPException(404, f"article not found: {slug}")
    title = html.escape(a.title or "untitled")
    eyebrow = f"{a.kind} · year {a.in_world_year}".upper()
    title_lines = _wrap_lines(title, max_chars=22, max_lines=4)
    line_height = 90
    title_block_h = line_height * len(title_lines)
    title_y_start = 320 - (title_block_h // 2) + 64
    title_lines_xml = "\n".join(
        f'      <text x="80" y="{title_y_start + i * line_height}" font-family="Georgia, \'Source Serif 4 Display\', serif" font-size="80" font-weight="600" fill="#1A1208">{html.escape(line)}</text>'
        for i, line in enumerate(title_lines)
    )
    eyebrow_xml = f'<text x="80" y="120" font-family="\'JetBrains Mono\', ui-monospace, monospace" font-size="22" letter-spacing="3" fill="#8B6624">{html.escape(eyebrow)}</text>'

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FDFBF6"/>
  <!-- Paper grain via fine dot pattern -->
  <defs>
    <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="0.4" fill="#1A1208" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#grain)"/>
  <!-- Gilt rule -->
  <line x1="80" y1="155" x2="240" y2="155" stroke="#B8893A" stroke-width="2"/>
  {eyebrow_xml}
{title_lines_xml}
  <!-- Footer wordmark -->
  <line x1="80" y1="540" x2="1120" y2="540" stroke="#1A1208" stroke-width="0.5" opacity="0.18"/>
  <text x="80" y="580" font-family="Georgia, 'Source Serif 4 Display', serif" font-size="32" font-weight="600" fill="#1A1208">Chroniclon</text>
  <text x="80" y="608" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="18" letter-spacing="2" fill="#6B5A3D">A WIKIPEDIA FOR A WORLD THAT DOESN'T EXIST</text>
  <text x="1120" y="608" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="18" letter-spacing="2" fill="#8B6624" text-anchor="end">HERMESGENESIS.WORLD</text>
</svg>
"""
    return Response(content=svg, media_type="image/svg+xml; charset=utf-8")


@router.get("/articles/{slug}")
async def get_article(slug: str) -> WikiArticle:
    a = store.load_article_by_slug(slug)
    if not a:
        raise HTTPException(404, f"article not found: {slug}")
    return a


@router.get("/eras")
async def list_eras() -> dict:
    return {"items": [e.model_dump() for e in store.list_eras()]}


@router.get("/audio/{slug}")
async def get_audio(slug: str):
    """Serve a rendered TTS chapter for an article. The audio is rendered by
    `python -m chroniclon.audio_chapter --slug <slug>` and saved to
    data/chroniclon/audio/<slug>.mp3."""
    safe = re.sub(r"[^a-z0-9\-]", "", slug.lower())
    audio_path = _chronicle_dir() / "audio" / f"{safe}.mp3"
    if not audio_path.exists():
        raise HTTPException(404, f"no audio rendered for slug: {safe}")
    return FileResponse(str(audio_path), media_type="audio/mpeg", filename=f"{safe}.mp3")


def _find_era_by_id(era_id: str):
    for e in store.list_eras():
        if e.era_id == era_id:
            return e
    return None


@router.get("/images/{slug}")
async def get_article_image(slug: str):
    """Serve the rendered hero image for an article. Generated by the
    auto-render hook in canon_agent or via POST /images/render."""
    safe = re.sub(r"[^a-z0-9\-]", "", (slug or "").lower())
    img_path = _chronicle_dir() / "images" / f"{safe}.webp"
    if not img_path.exists():
        raise HTTPException(404, f"no image rendered for slug: {safe}")
    return FileResponse(str(img_path), media_type="image/webp", filename=f"{safe}.webp")


class RenderImageRequest(BaseModel):
    slug: str


@router.post("/images/render")
async def render_image(req: RenderImageRequest) -> dict:
    """On-demand article hero image render. Used by the MCP bridge and the
    retrofit CLI. Re-runs always overwrite the existing webp."""
    from chroniclon.illustrations import is_configured as _img_configured
    from chroniclon.illustrations import render_article_image

    if not _img_configured():
        raise HTTPException(503, "IMAGE_API_KEY not set — image rendering disabled")
    slug = re.sub(r"[^a-z0-9\-]", "", (req.slug or "").lower())
    if not slug:
        raise HTTPException(400, "slug required")
    article = store.load_article_by_slug(slug)
    if article is None:
        raise HTTPException(404, f"article not found: {slug}")
    era = _find_era_by_id(article.era_id)
    art_style = (getattr(era, "art_style", "") or "") if era else ""
    result = await render_article_image(
        slug=slug,
        kind=article.kind,
        title=article.title,
        era_art_style=art_style,
        character=None,  # MCP/CLI path — no character context yet
    )
    article.illustration_url = result["url"]
    store.save_article(article)
    return result


class RenderAudioRequest(BaseModel):
    slug: str


@router.post("/audio/render")
async def render_audio(req: RenderAudioRequest) -> dict:
    """On-demand audio render for an existing article — used by the MCP bridge
    so hermes-agent can voice an article without invoking the CLI. Idempotent;
    re-running overwrites the existing mp3.
    """
    from chroniclon.voices import is_configured as _tts_configured
    from chroniclon.audio_chapter import render_chapter

    if not _tts_configured():
        raise HTTPException(503, "TTS not configured — set TTS_PROVIDER and the matching API key")
    slug = re.sub(r"[^a-z0-9\-]", "", (req.slug or "").lower())
    if not slug:
        raise HTTPException(400, "slug required")
    if not store.load_article_by_slug(slug):
        raise HTTPException(404, f"article not found: {slug}")
    return await render_chapter(slug)


@router.get("/lexicon")
async def lexicon() -> dict:
    return {"items": [le.model_dump() for le in store.list_linguistic_eras()]}


# --------------------------------------------------------------------------- #
#  Audience contribution                                                       #
# --------------------------------------------------------------------------- #

class SubmissionRequest(BaseModel):
    contributor_handle: str = Field(default="anonymous", max_length=64)
    seed_text: str = Field(..., min_length=1, max_length=600)


@router.post("/submit")
async def submit(req: SubmissionRequest) -> dict:
    """Audience canonization loop.

    Pipeline:
      1. Save the raw submission as pending.
      2. Hermes moderates: safety + canon-consistency + in-world tone.
         Rejected → submission marked `rejected`, reason returned.
      3. Hermes synthesizes a structured Event from the seed.
      4. canonize_event runs the full Kimi-write + Hermes-critic pipeline.
      5. Submission is updated with the canonized article slug; the
         article carries `contributor=<handle>` so the wiki credits them.
    """
    import uuid
    from chroniclon.models import CanonSubmission
    from chroniclon import era as era_mod
    from chroniclon.canon_agent import moderate_and_synthesize_submission, canonize_event
    from store import list_worlds, load_world

    handle = (req.contributor_handle or "anonymous").strip()[:64]
    seed = (req.seed_text or "").strip()
    if not seed:
        raise HTTPException(400, "seed_text required")
    if len(seed) > 600:
        raise HTTPException(400, "seed_text too long (max 600 chars)")

    sub = CanonSubmission(
        submission_id=f"sub_{uuid.uuid4().hex[:12]}",
        contributor_handle=handle,
        seed_text=seed,
    )
    store.save_submission(sub)

    # Pick the most recent ready world to attach this submission to.
    candidates = [w for w in list_worlds() if w.get("status") == "ready"]
    if not candidates:
        sub.moderation = "rejected"
        sub.moderation_reason = "no active world"
        store.save_submission(sub)
        return {
            "submission_id": sub.submission_id,
            "status": "rejected",
            "reason": sub.moderation_reason,
        }
    target_world_summary = candidates[0]
    world = load_world(target_world_summary["id"])
    if not world:
        sub.moderation = "rejected"
        sub.moderation_reason = "world load failed"
        store.save_submission(sub)
        return {
            "submission_id": sub.submission_id,
            "status": "rejected",
            "reason": sub.moderation_reason,
        }

    era = era_mod.current_era()
    if era is None:
        sub.moderation = "rejected"
        sub.moderation_reason = "no active era"
        store.save_submission(sub)
        return {
            "submission_id": sub.submission_id,
            "status": "rejected",
            "reason": sub.moderation_reason,
        }

    moderation = await moderate_and_synthesize_submission(
        seed_text=seed,
        world_name=world.name,
        world_seed=world.seed,
        era_name=era.name,
        era_summary=era.summary or "",
        in_world_year=era.start_year + max(0, world.current_day // 5),
    )
    if not moderation.get("accept"):
        sub.moderation = "rejected"
        sub.moderation_reason = moderation.get("reasoning", "rejected")
        store.save_submission(sub)
        return {
            "submission_id": sub.submission_id,
            "status": "rejected",
            "reason": sub.moderation_reason,
        }

    sub.moderation = "approved"
    sub.moderation_reason = moderation.get("reasoning", "")
    store.save_submission(sub)

    syn = moderation["event"]
    synthesized_event = {
        "id": f"evt_aud_{uuid.uuid4().hex[:8]}",
        "day": world.current_day,
        "type": syn["type"],
        "title": syn["title"],
        "narrative": syn["narrative"],
        "actors": [],
        "factions_involved": [],
        "regions_affected": [],
        "agent_triggered": False,
        "user_triggered": True,
        "caused_by": "",
        "prophecy_id": "",
    }

    # Persist the synthesized event to the world before canonizing so the
    # Civilization Autopsy view can find it later (audit Wow #2).
    from models.event import Event
    from store import save_world, get_lock
    lock = get_lock(world.id)
    async with lock:
        from store import load_world as _load
        live_world = _load(world.id) or world
        live_world.events.append(Event(**synthesized_event))
        save_world(live_world)
        world = live_world

    in_world_year = era.start_year + max(0, world.current_day // 5)
    article = await canonize_event(
        world_name=world.name,
        seed=world.seed,
        era_id=era.era_id,
        era_name=era.name,
        era_art_style=getattr(era, "art_style", "") or "",
        in_world_year=in_world_year,
        event=synthesized_event,
        linguistic_notes=era_mod.linguistic_notes_for_era(era),
        contributor=handle,
        world_id=world.id,
    )

    if article is None:
        sub.moderation_reason = (sub.moderation_reason + " | hermes declined to canonize").strip(" |")
        store.save_submission(sub)
        return {
            "submission_id": sub.submission_id,
            "status": "approved_but_skipped",
            "reason": "Hermes accepted the seed but declined to canonize it as an article.",
        }

    sub.canonized_article_id = article.article_id
    store.save_submission(sub)
    return {
        "submission_id": sub.submission_id,
        "status": "canonized",
        "article": {
            "slug": article.slug,
            "title": article.title,
            "kind": article.kind,
            "voice": article.voice,
            "word_count": article.word_count,
        },
        "contributor": handle,
    }


@router.get("/submissions", dependencies=[Depends(require_admin)])
async def list_submissions(status: str | None = None) -> dict:
    """Pending moderation queue. Admin-only — content here may include
    user-submitted PII before being canonized or rejected."""
    return {"items": [s.model_dump() for s in store.list_submissions(status)]}


@router.get("/autopsy/{slug}")
async def article_autopsy(slug: str) -> dict:
    """Civilization Autopsy: trace an article back to the simulation event,
    then walk the causal chain (ancestors via `caused_by`, descendants via
    overlapping actors/factions) and surface every signal that shaped the
    moment.

    Used to render a 'why this happened' panel on the article-detail page —
    proves the simulation is causal, not just generative.
    """
    article = store.load_article_by_slug(slug)
    if not article:
        raise HTTPException(404, f"article not found: {slug}")
    if not article.source_event_id or not article.source_world_id:
        return {"linked": False, "article_slug": slug}

    # Lazy-import to avoid circular dep with worlds store at module load.
    from store import load_world
    world = load_world(article.source_world_id)
    if not world:
        return {"linked": False, "article_slug": slug, "reason": "world not found"}

    by_id = {e.id: e for e in world.events}
    src = by_id.get(article.source_event_id)
    if not src:
        return {"linked": False, "article_slug": slug, "reason": "event not found"}

    # 1) Ancestor chain: walk caused_by backward (cap depth to avoid loops).
    ancestors: list[dict] = []
    cursor = src.caused_by
    seen: set[str] = {src.id}
    while cursor and cursor not in seen and len(ancestors) < 6:
        anc = by_id.get(cursor)
        if not anc:
            break
        ancestors.append({
            "id": anc.id, "day": anc.day, "type": anc.type, "title": anc.title,
            "narrative": anc.narrative[:200] if anc.narrative else "",
        })
        seen.add(anc.id)
        cursor = anc.caused_by

    # 2) Descendants: events caused-by ours, plus same-actor follow-ups.
    direct_descendants = [
        {"id": e.id, "day": e.day, "type": e.type, "title": e.title,
         "narrative": e.narrative[:200] if e.narrative else ""}
        for e in world.events
        if e.caused_by == src.id and e.id != src.id
    ][:8]

    src_actors = set(src.actors or [])
    src_factions = set(src.factions_involved or [])
    follow_ups = []
    for e in world.events:
        if e.id == src.id or e.day <= src.day:
            continue
        if any(a in src_actors for a in (e.actors or [])) or any(f in src_factions for f in (e.factions_involved or [])):
            follow_ups.append({
                "id": e.id, "day": e.day, "type": e.type, "title": e.title,
                "shared_actors": [a for a in (e.actors or []) if a in src_actors][:3],
                "shared_factions": [f for f in (e.factions_involved or []) if f in src_factions][:3],
            })
            if len(follow_ups) >= 8:
                break

    # 3) Faction context: name lookups for the IDs in the source event.
    faction_lookup = {f.id: {"name": f.name, "color": f.color, "ideology": f.ideology} for f in world.factions}
    char_lookup = {c.id: {"name": c.name, "alive": c.alive, "role": c.role} for c in world.characters}

    # 4) Outcome digest: surface only non-empty outcome buckets.
    outcome = src.outcome.model_dump() if src.outcome else {}
    outcome_summary = {
        "territory_changes": {
            faction_lookup.get(fid, {}).get("name", fid) or fid: fid_to
            for fid, fid_to in (outcome.get("territory_changes") or {}).items()
        },
        "casualties": outcome.get("casualties") or {},
        "morale_changes": outcome.get("morale_changes") or {},
        "character_effects": (outcome.get("character_effects") or [])[:5],
    }

    # 5) Related articles by overlapping actors (other canon written from same lineage).
    related_articles: list[dict] = []
    if src_actors or src_factions:
        for r in store.list_articles(limit=2000):
            if r["slug"] == slug:
                continue
            other = store.load_article_by_slug(r["slug"])
            if not other or not other.source_event_id:
                continue
            other_ev = by_id.get(other.source_event_id)
            if not other_ev:
                continue
            if (set(other_ev.actors or []) & src_actors) or (set(other_ev.factions_involved or []) & src_factions):
                related_articles.append({
                    "slug": other.slug,
                    "title": other.title,
                    "in_world_year": other.in_world_year,
                    "kind": other.kind,
                })
                if len(related_articles) >= 6:
                    break

    return {
        "linked": True,
        "article_slug": slug,
        "world_id": world.id,
        "world_name": world.name,
        "source_event": {
            "id": src.id,
            "day": src.day,
            "type": src.type,
            "title": src.title,
            "narrative": src.narrative,
            "actors": [{"id": a, **char_lookup.get(a, {})} for a in (src.actors or [])],
            "factions": [{"id": f, **faction_lookup.get(f, {})} for f in (src.factions_involved or [])],
            "regions_affected": src.regions_affected or [],
            "agent_triggered": bool(src.agent_triggered),
            "user_triggered": bool(src.user_triggered),
            "prophecy_id": src.prophecy_id or None,
        },
        "ancestors": ancestors,
        "direct_descendants": direct_descendants,
        "follow_ups": follow_ups,
        "outcome": outcome_summary,
        "related_articles": related_articles,
    }


@router.get("/eras")
async def list_eras_endpoint() -> dict:
    """All eras the canon has lived through. Used by the era ceremony picker."""
    return {"items": [e.model_dump() for e in store.list_eras()]}


@router.get("/era-transition/{era_id}")
async def era_transition(era_id: str) -> dict:
    """Cinematic payload for the transition INTO `era_id`. Composes:
      - closing era (the previous one): name, summary, dominant factions
      - new era: name, art style, premise (= summary)
      - linguistic delta: rules added in the new era vs parent
      - sample lexicon for the new tongue
      - dominant factions of the new era

    Returned as a single blob the frontend can render as a full-screen
    ceremony without further API calls.
    """
    eras = store.list_eras()
    new_era = next((e for e in eras if e.era_id == era_id), None)
    if not new_era:
        raise HTTPException(404, f"era not found: {era_id}")

    # Closing era is the one immediately preceding by ordinal.
    closing = next((e for e in eras if e.ordinal == new_era.ordinal - 1), None)

    # Linguistic data — the era's tongue and the parent's, for delta rendering.
    lings = store.list_linguistic_eras()
    new_ling = next((le for le in lings if le.era_id == new_era.linguistic_era), None) if new_era.linguistic_era else None
    parent_ling = None
    if new_ling and new_ling.parent_era:
        parent_ling = next((le for le in lings if le.era_id == new_ling.parent_era), None)

    # Lexicon delta: words present in both, drifted spelling.
    lex_delta: list[dict] = []
    if new_ling and parent_ling:
        for en, new_word in new_ling.sample_lexicon.items():
            old_word = parent_ling.sample_lexicon.get(en)
            if old_word and old_word != new_word:
                lex_delta.append({"en": en, "old": old_word, "new": new_word})
            elif not old_word and new_word:
                lex_delta.append({"en": en, "old": "", "new": new_word})
        lex_delta = lex_delta[:8]

    return {
        "closing": {
            "era_id": closing.era_id if closing else None,
            "name": closing.name if closing else None,
            "summary": closing.summary if closing else "",
            "dominant_factions": closing.dominant_factions if closing else [],
            "art_style": closing.art_style if closing else "",
        } if closing else None,
        "new": {
            "era_id": new_era.era_id,
            "name": new_era.name,
            "premise": new_era.summary,
            "art_style": new_era.art_style,
            "dominant_factions": new_era.dominant_factions,
            "start_year": new_era.start_year,
        },
        "language": {
            "phonology_notes": new_ling.phonology_notes if new_ling else "",
            "phonological_rules": [r.model_dump() for r in (new_ling.phonological_rules if new_ling else [])],
            "morphology": new_ling.morphology.model_dump() if new_ling else {},
            "lex_delta": lex_delta,
            "sample_text": new_ling.sample_text if new_ling else "",
            "inscriptions": [i.model_dump() for i in (new_ling.inscriptions if new_ling else [])],
        },
    }


@router.get("/contributors")
async def list_contributors() -> dict:
    """Public list of canonized contributors and their article counts.
    Pending submissions are NOT exposed here (see /submissions, admin-only)."""
    counts: dict[str, int] = {}
    for s in store.list_submissions():
        if not s.canonized_article_id:
            continue
        if not s.contributor_handle:
            continue
        counts[s.contributor_handle] = counts.get(s.contributor_handle, 0) + 1
    items = [{"handle": h, "canonized_count": n} for h, n in sorted(counts.items(), key=lambda kv: -kv[1])]
    return {"items": items, "total": len(items)}


# --------------------------------------------------------------------------- #
#  Live regen — demo flow that proves the engine works on any seed             #
# --------------------------------------------------------------------------- #

class RegenRequest(BaseModel):
    seed: str = Field(..., min_length=1, max_length=600)
    days: int = Field(default=5, ge=1, le=12)
    # "kimi" makes Kimi K2.6 write the article bodies (visible in the demo,
    # required for the Kimi track). "nous" stays cheap. Anything else falls
    # through to the regen default.
    provider: str | None = None


# --------------------------------------------------------------------------- #
#  Canon Control Room                                                          #
# --------------------------------------------------------------------------- #

@router.get("/control/backlog")
async def control_backlog(limit: int = Query(default=50, ge=1, le=80)) -> dict:
    """Recent canonization phase events. Frontend hits this on first load
    before subscribing to the SSE stream so the page is alive immediately."""
    return {"items": control_stream.backlog_snapshot(limit=limit)}


@router.post("/control/ingest")
async def control_ingest(event: dict) -> dict:
    """Receive a phase event from a sibling process (e.g. the chroniclon
    runner container). Re-broadcasts to local SSE subscribers.

    Auth is enforced upstream by the global API-key middleware on POST
    routes. Without a valid key, this 403s before reaching here.
    """
    if not isinstance(event, dict) or not event:
        raise HTTPException(400, "event payload required")
    control_stream.ingest_remote(event)
    return {"ingested": True}


@router.get("/control/stream")
async def control_event_stream():
    """SSE feed of canonization phase events for the Control Room.

    Each event is a JSON blob with at least: ts, phase, pipeline_id, model,
    stage. Phases include: decision_started, decision_complete, skipped,
    writing_started, writing_complete, antislop_complete, factcheck_complete,
    revision_started, crosslinks_complete, published, audio_started,
    audio_complete, audio_failed.
    """
    async def gen():
        q = await control_stream.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # Heartbeat keeps proxies / browsers from closing the connection.
                    yield "event: ping\ndata: {}\n\n"
                    continue
                yield f"event: phase\ndata: {json.dumps(event)}\n\n"
        finally:
            control_stream.unsubscribe(q)

    return EventSourceResponse(gen())


@router.post("/regen/stream")
async def regen_stream(req: RegenRequest):
    seed = (req.seed or "").strip()
    if not seed:
        raise HTTPException(400, "seed required")
    if len(seed) > 600:
        raise HTTPException(400, "seed too long (max 600 chars)")
    days = max(1, min(int(req.days or 5), 12))
    provider = (req.provider or "").strip().lower()
    if provider not in ("kimi", "nous"):
        provider = "kimi"  # default: showcase Kimi for the Kimi track

    async def gen():
        async for chunk in stream_regen(seed, days, writer_provider=provider):
            # sse-starlette accepts dicts or already-formatted strings; we hand it our raw frames
            yield chunk

    return EventSourceResponse(gen())
