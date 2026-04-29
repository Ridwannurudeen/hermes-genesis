"""Live regen — the demo flow that proves Chroniclon works on any seed.

Pipeline:
  1. Generate a Genesis world from a seed (existing pipeline)
  2. Run a few simulation ticks to produce events
  3. Canonize the most pivotal events through the chroniclon agent
  4. Stream all of it as SSE so the frontend can play a time-lapse

This is intentionally compact — not the 144-hour autonomous run. It produces
a small "starter civilization" (~3-5 articles, 1 era, partial linguistic
snapshot) suitable for a 60-90 second demo recording.
"""
import asyncio
import json
import logging
import uuid
from typing import AsyncIterator

from generator import generate_world
from simulation import simulate_tick
from store import save_world
from chroniclon import store
from chroniclon.canon_agent import canonize_event
from chroniclon.era import linguistic_notes_for_era, generate_drift
from chroniclon.models import Era

logger = logging.getLogger(__name__)


REGEN_DEFAULT_DAYS = 5
REGEN_MAX_ARTICLES = 6
# Default writer for live regen demos. Defaults to Kimi so the Kimi track has a
# demonstrable interactive surface; callers can override via the API.
REGEN_DEFAULT_WRITER = "kimi"


def _sse_event(name: str, data: dict | str) -> str:
    body = data if isinstance(data, str) else json.dumps(data)
    return f"event: {name}\ndata: {body}\n\n"


async def stream_regen(
    seed: str,
    days: int = REGEN_DEFAULT_DAYS,
    writer_provider: str = REGEN_DEFAULT_WRITER,
) -> AsyncIterator[str]:
    """Yield SSE events for a fresh civilization regen."""
    yield _sse_event(
        "progress",
        {"stage": "starting", "detail": f"seed: {seed[:120]}", "writer": writer_provider},
    )

    progress_q: asyncio.Queue[dict] = asyncio.Queue()

    async def on_progress(data: dict) -> None:
        await progress_q.put(data)

    # ---- world generation (Genesis) ----
    gen_task = asyncio.create_task(
        generate_world(seed=seed, num_regions=4, num_factions=3, num_characters=8, on_progress=on_progress)
    )
    while not gen_task.done():
        try:
            event = await asyncio.wait_for(progress_q.get(), timeout=0.5)
            yield _sse_event("progress", event)
        except asyncio.TimeoutError:
            yield _sse_event("ping", "")
    # Drain any remaining
    while not progress_q.empty():
        yield _sse_event("progress", await progress_q.get())

    try:
        world = await gen_task
    except Exception as e:
        logger.exception("regen world gen failed")
        yield _sse_event("error", {"message": f"world generation failed: {e}"})
        return

    yield _sse_event(
        "world_ready",
        {
            "world_id": world.id,
            "name": world.name,
            "regions": len(world.geography.regions),
            "factions": len(world.factions),
            "characters": len(world.characters),
        },
    )

    # ---- ensure regen has its own era namespace ----
    era_id = f"era_regen_{uuid.uuid4().hex[:6]}"
    era = Era(
        era_id=era_id,
        name=f"The Founding of {world.name}",
        ordinal=0,
        start_year=0,
        summary=f"The dawn of {world.name}, born of: {seed}",
        art_style="hand-illuminated manuscript, parchment tones, ink wash",
    )
    store.save_era(era)
    yield _sse_event("era_opened", {"era_id": era.era_id, "name": era.name})

    # Bootstrap a linguistic snapshot before any articles render so the prose has flavor.
    try:
        le = await generate_drift(world.name, era.name, 0)
        era.linguistic_era = le.era_id
        store.save_era(era)
        yield _sse_event(
            "linguistic_drift",
            {"era_id": era.era_id, "lexicon": list(le.sample_lexicon.items())[:8]},
        )
    except Exception as e:
        logger.warning(f"regen linguistic bootstrap failed: {e}")

    # ---- simulate a few days ----
    yield _sse_event("progress", {"stage": "simulating", "detail": f"running {days} days"})
    for d in range(1, days + 1):
        try:
            world.current_day = d
            new_events = simulate_tick(world)
            world.events.extend(new_events)
            save_world(world)
            yield _sse_event(
                "day_complete",
                {"day": d, "new_events": [e.model_dump(mode="json") for e in new_events]},
            )
        except Exception as e:
            logger.exception(f"sim tick {d} failed")
            yield _sse_event("error", {"message": f"simulation failed at day {d}: {e}"})

    # ---- canonize a curated subset ----
    yield _sse_event("progress", {"stage": "canonizing", "detail": f"writing up to {REGEN_MAX_ARTICLES} articles"})
    written = 0
    notes = linguistic_notes_for_era(era)
    for ev in world.events:
        if written >= REGEN_MAX_ARTICLES:
            break
        ed = ev.model_dump(mode="json") if hasattr(ev, "model_dump") else ev
        try:
            article = await canonize_event(
                world_name=world.name,
                seed=world.seed,
                era_id=era.era_id,
                era_name=era.name,
                in_world_year=int(ed.get("day", 0)),
                event=ed,
                linguistic_notes=notes,
                writer_provider=writer_provider,
            )
        except Exception as e:
            logger.exception(f"canonize {ed.get('id','?')} failed")
            continue
        if article is None:
            continue
        written += 1
        yield _sse_event(
            "article_canonized",
            {
                "slug": article.slug,
                "title": article.title,
                "kind": article.kind,
                "voice": article.voice,
                "word_count": article.word_count,
                "in_world_year": article.in_world_year,
                # Make model provenance visible in the regen UI for the
                # Kimi-track demo. Backend → frontend pass-through.
                "writer": writer_provider,
                "writer_label": "Kimi-K2.6" if writer_provider == "kimi" else "Hermes-4-70B",
            },
        )

    yield _sse_event(
        "complete",
        {
            "world_id": world.id,
            "world_name": world.name,
            "era_id": era.era_id,
            "articles_written": written,
        },
    )
