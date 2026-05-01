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

    # Cache for character lookups so we don't rebuild per-event.
    char_by_id = {c.id: c for c in world.characters}
    faction_name_by_id = {f.id: f.name for f in world.factions}

    def _lead_character_for(event_dict: dict) -> dict | None:
        """Build a rich descriptor of the event's lead actor — name, role,
        faction, genome — used by audio archetype routing and image grounding.
        Returns None if no actor matches; both downstream renderers handle that."""
        actors = event_dict.get("actors") or []
        for cid in actors:
            char = char_by_id.get(cid)
            if not char:
                continue
            g = getattr(char, "genome", None)
            genome_dict = (
                g.model_dump() if g is not None and hasattr(g, "model_dump") else g
            )
            return {
                "id": getattr(char, "id", cid),
                "name": getattr(char, "name", "") or "",
                "role": getattr(char, "role", "") or "",
                "faction_id": getattr(char, "faction_id", "") or "",
                "faction_name": faction_name_by_id.get(getattr(char, "faction_id", ""), ""),
                "genome": genome_dict,
            }
        return None

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
                era_art_style=getattr(active_era, "art_style", "") or "",
                in_world_year=in_world_year,
                event=ev,
                linguistic_notes=linguistic_notes_for_era(active_era),
                lead_character=_lead_character_for(ev),
                world_id=world.id,
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


def _quick_sim_tick(world_id: str, days: int = 1) -> int:
    """Advance the world by N days using the cheap CPU-only simulation path.

    No LLM narration, no prophecy LLM check — those run for the canon agent
    (which writes its own prose). The point is to keep the event queue fed so
    the runner has something to canonize on the next poll. Returns the number
    of new events generated."""
    from store import load_world as _load_world, save_world as _save_world
    from simulation import simulate_tick as _simulate_tick

    world = _load_world(world_id)
    if world is None:
        return 0
    total = 0
    for _ in range(max(1, days)):
        events = _simulate_tick(world)
        total += len(events)
    _save_world(world)
    return total


async def run_forever(world_id: str, auto_simulate: bool = True) -> None:
    """Long-running loop: process new events whenever they appear.

    When the queue is empty AND auto_simulate is true, advance the world by
    one cheap simulation tick so canon keeps growing 24/7 without manual
    POSTs to /simulate. Configurable via env: AUTO_SIM_TICK_DAYS=1,
    AUTO_SIM_MIN_EVENTS=2 (skip auto-sim if even one canonized event happened
    in the last cycle — the runner is busy enough)."""
    import os

    auto_days = max(1, int(os.getenv("AUTO_SIM_TICK_DAYS", "1")))
    while True:
        events_seen = 0
        try:
            cursor_before = _load_cursor(world_id)
            canon_before = cursor_before.get("events_canonized", 0)
            await run_once(world_id)
            cursor_after = _load_cursor(world_id)
            events_seen = (
                cursor_after.get("events_canonized", 0) - canon_before
                + cursor_after.get("events_skipped", 0)
                - cursor_before.get("events_skipped", 0)
            )
        except SystemExit:
            raise
        except Exception as e:
            logger.exception(f"runner cycle failed: {e}")

        if auto_simulate and events_seen == 0:
            try:
                new_n = _quick_sim_tick(world_id, days=auto_days)
                if new_n > 0:
                    logger.info(f"{world_id}: auto-sim produced {new_n} new events")
            except Exception as e:
                logger.exception(f"auto-sim failed: {e}")

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
    parser.add_argument(
        "--no-auto-simulate",
        action="store_true",
        help="Disable auto-simulate fallback when the event queue is empty.",
    )
    args = parser.parse_args()

    _setup_logging()
    started = time.time()
    if args.once:
        cursor = asyncio.run(run_once(args.world_id, max_events=args.max_events))
        logger.info(f"done in {time.time() - started:.1f}s — cursor={cursor}")
    else:
        asyncio.run(run_forever(args.world_id, auto_simulate=not args.no_auto_simulate))


if __name__ == "__main__":
    main()
