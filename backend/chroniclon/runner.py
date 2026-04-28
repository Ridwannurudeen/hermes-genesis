"""Autonomous canon runner — the long process that produces wiki articles
from Genesis simulation events for the 144-hour hackathon run.

Design:
- Independent of FastAPI / Genesis routes. Reads world JSON from disk via
  `store.load_world` and writes articles via `chroniclon.store`.
- Idempotent: tracks last-canonized event id per world in a small cursor file.
  Re-running picks up where it left off — survives restarts.
- Backpressure-aware: spaces calls to respect Kimi rate limits.
- One world at a time per process (matches the canon submission's single
  civilization). Multi-world support is trivial but not needed for the run.

Usage:
    python -m chroniclon.runner --world-id world_xxx
    python -m chroniclon.runner --world-id world_xxx --max-events 50

Environment:
    NOUS_API_KEY, KIMI_API_KEY required for end-to-end.
    CHRONICLON_DIR controls where canon is persisted.
"""
import argparse
import asyncio
import json
import logging
import sys
import time
from pathlib import Path

from config import CHRONICLON_DIR
from store import load_world
from chroniclon import store
from chroniclon.canon_agent import canonize_event
from chroniclon.era import (
    current_era,
    linguistic_notes_for_era,
    maybe_advance_era,
)
from chroniclon.models import Era

logger = logging.getLogger("chroniclon.runner")


# Pause between events to space LLM calls (rate-limit friendly + allow critic loops to settle)
DEFAULT_INTER_EVENT_PAUSE_S = 4.0
# How often to poll for new world events when the simulation hasn't advanced
POLL_INTERVAL_S = 30.0


def _cursor_path(world_id: str) -> Path:
    return Path(CHRONICLON_DIR) / "_cursors" / f"{world_id}.json"


def _load_cursor(world_id: str) -> dict:
    p = _cursor_path(world_id)
    if not p.exists():
        return {"last_event_id": None, "events_canonized": 0, "events_skipped": 0}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"last_event_id": None, "events_canonized": 0, "events_skipped": 0}


def _save_cursor(world_id: str, cursor: dict) -> None:
    p = _cursor_path(world_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(cursor, indent=2), encoding="utf-8")


def _ensure_default_era(world) -> Era:
    """Ensure at least one Era exists for the world. Maps Genesis day -> in-world year via era multiplier."""
    eras = store.list_eras()
    if eras:
        return eras[-1]
    # Bootstrap era 0 from the world's seed
    era = Era(
        era_id="era_0",
        name="The Founding Era",
        ordinal=0,
        start_year=0,
        summary=f"The dawn of {world.name}, born of the seed: {world.seed}",
        art_style="hand-illuminated manuscript, parchment tones, ink wash",
    )
    store.save_era(era)
    logger.info(f"bootstrapped {era.name}")
    return era


def _new_events_since(world, last_event_id: str | None) -> list[dict]:
    """Return events from world.events that came after last_event_id."""
    if not last_event_id:
        return [e.model_dump() if hasattr(e, "model_dump") else e for e in world.events]
    out: list[dict] = []
    found = False
    for e in world.events:
        ed = e.model_dump() if hasattr(e, "model_dump") else e
        if found:
            out.append(ed)
        elif ed.get("id") == last_event_id:
            found = True
    if not found:
        # Cursor event no longer present (rare); replay everything to be safe
        return [e.model_dump() if hasattr(e, "model_dump") else e for e in world.events]
    return out


async def run_once(world_id: str, max_events: int | None = None) -> dict:
    """Process all unprocessed events for a world, then return."""
    world = load_world(world_id)
    if world is None:
        raise SystemExit(f"world not found: {world_id}")

    era = _ensure_default_era(world)
    cursor = _load_cursor(world_id)

    new_events = _new_events_since(world, cursor.get("last_event_id"))
    logger.info(f"{world_id}: {len(new_events)} new events to consider")

    processed = 0
    for ev in new_events:
        if max_events is not None and processed >= max_events:
            break

        # Refresh era — may have advanced after the previous event
        active_era = current_era() or era
        in_world_year = int(ev.get("day", 0))
        try:
            article = await canonize_event(
                world_name=world.name,
                seed=world.seed,
                era_id=active_era.era_id,
                era_name=active_era.name,
                in_world_year=in_world_year,
                event=ev,
                linguistic_notes=linguistic_notes_for_era(active_era),
            )
            if article is not None:
                cursor["events_canonized"] = cursor.get("events_canonized", 0) + 1
            else:
                cursor["events_skipped"] = cursor.get("events_skipped", 0) + 1
        except Exception as e:
            logger.exception(f"canonize_event failed for {ev.get('id','?')}: {e}")
            cursor["events_skipped"] = cursor.get("events_skipped", 0) + 1

        # After every canonization, ask whether the era should advance
        try:
            advanced = await maybe_advance_era(world.name, in_world_year)
            if advanced is not None:
                cursor["last_era_id"] = advanced.era_id
        except Exception as e:
            logger.exception(f"era advance failed: {e}")

        cursor["last_event_id"] = ev.get("id")
        _save_cursor(world_id, cursor)
        processed += 1
        await asyncio.sleep(DEFAULT_INTER_EVENT_PAUSE_S)

    logger.info(f"{world_id}: processed {processed} events")
    return cursor


async def run_forever(world_id: str) -> None:
    """Long-running loop: process new events whenever they appear, sleep otherwise."""
    while True:
        try:
            await run_once(world_id)
        except SystemExit:
            raise
        except Exception as e:
            logger.exception(f"runner cycle failed: {e}")
        await asyncio.sleep(POLL_INTERVAL_S)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        stream=sys.stdout,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Chroniclon autonomous canon runner")
    parser.add_argument("--world-id", required=True, help="Genesis world id")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Process current events and exit (default: run forever)",
    )
    parser.add_argument(
        "--max-events",
        type=int,
        default=None,
        help="Cap events processed in this invocation (mostly for --once)",
    )
    args = parser.parse_args()

    _setup_logging()
    started = time.time()
    if args.once:
        cursor = asyncio.run(run_once(args.world_id, max_events=args.max_events))
        logger.info(f"done in {time.time() - started:.1f}s — cursor={cursor}")
    else:
        asyncio.run(run_forever(args.world_id))


if __name__ == "__main__":
    main()
