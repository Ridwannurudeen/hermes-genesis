"""FastAPI routes for the Chroniclon wiki.

Mounted at /api/chronicle/* by main.py.
"""
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from config import CHRONICLON_DIR
from chroniclon import store
from chroniclon.models import WikiArticle
from chroniclon.regen import stream_regen


router = APIRouter(prefix="/api/chronicle", tags=["chronicle"])


# --------------------------------------------------------------------------- #
#  Stats / index                                                              #
# --------------------------------------------------------------------------- #

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
    limit: int = Query(default=50, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return {"items": store.list_articles(era_id=era_id, kind=kind, limit=limit, offset=offset)}


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
    audio_path = Path(CHRONICLON_DIR) / "audio" / f"{safe}.mp3"
    if not audio_path.exists():
        raise HTTPException(404, f"no audio rendered for slug: {safe}")
    return FileResponse(str(audio_path), media_type="audio/mpeg", filename=f"{safe}.mp3")


@router.get("/lexicon")
async def lexicon() -> dict:
    return {"items": [le.model_dump() for le in store.list_linguistic_eras()]}


# --------------------------------------------------------------------------- #
#  Audience contribution                                                       #
# --------------------------------------------------------------------------- #

class SubmissionRequest(BaseModel):
    contributor_handle: str
    seed_text: str


@router.post("/submit")
async def submit(req: SubmissionRequest) -> dict:
    import uuid
    from chroniclon.models import CanonSubmission

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
    return {"submission_id": sub.submission_id, "status": "pending"}


@router.get("/submissions")
async def list_submissions(status: str | None = None) -> dict:
    return {"items": [s.model_dump() for s in store.list_submissions(status)]}


# --------------------------------------------------------------------------- #
#  Live regen — demo flow that proves the engine works on any seed             #
# --------------------------------------------------------------------------- #

class RegenRequest(BaseModel):
    seed: str
    days: int = 5


@router.post("/regen/stream")
async def regen_stream(req: RegenRequest):
    seed = (req.seed or "").strip()
    if not seed:
        raise HTTPException(400, "seed required")
    if len(seed) > 600:
        raise HTTPException(400, "seed too long (max 600 chars)")
    days = max(1, min(int(req.days or 5), 12))

    async def gen():
        async for chunk in stream_regen(seed, days):
            # sse-starlette accepts dicts or already-formatted strings; we hand it our raw frames
            yield chunk

    return EventSourceResponse(gen())
