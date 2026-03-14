import asyncio
from fastapi import APIRouter, HTTPException, Query
from store import load_world, save_world, get_lock
from simulation import simulate_tick
from llm import chat_completion
from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt
from prompts.obituary import SYSTEM as OBITUARY_SYSTEM, obituary_prompt
from prophecy_checker import check_and_fulfill_prophecies

router = APIRouter(prefix="/api/worlds", tags=["simulation"])

@router.post("/{world_id}/simulate")
async def run_simulation(world_id: str, days: int = Query(default=1, ge=1, le=30)):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    lock = get_lock(world_id)
    all_events = []
    prophecy_fulfilled_data = None
    actual_days = 0
    capped = min(days, 30)

    for _ in range(capped):
        # Phase 1: simulate under lock (fast)
        async with lock:
            world = load_world(world_id)
            if not world:
                break
            events = simulate_tick(world)
            world = load_world(world_id)
            actual_days += 1
            world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"
            save_world(world)

        # Phase 2: narrate + obituary IN PARALLEL (all events at once, NO lock)
        async def _narrate(evt):
            if evt.type != "death":
                try:
                    narrative = await chat_completion(
                        NARRATOR_SYSTEM, event_prompt(evt.model_dump(), world_ctx),
                        max_tokens=300,
                    )
                    evt.narrative = narrative.strip()
                except Exception:
                    evt.narrative = evt.title
            elif evt.actors:
                char_id = evt.actors[0]
                char = next((c for c in world.characters if c.id == char_id), None)
                if char:
                    char_events = [e.model_dump() for e in world.events if char_id in e.actors]
                    try:
                        obit = await chat_completion(
                            OBITUARY_SYSTEM,
                            obituary_prompt(char.model_dump(), char_events, world_ctx),
                            max_tokens=200,
                        )
                        evt.obituary = obit.strip()
                    except Exception:
                        pass

        await asyncio.gather(*[_narrate(evt) for evt in events])

        # Phase 3: merge narratives under lock (fast)
        async with lock:
            world = load_world(world_id)
            if world:
                for event in events:
                    for e in world.events:
                        if e.id == event.id:
                            if event.narrative:
                                e.narrative = event.narrative
                            if event.obituary:
                                e.obituary = event.obituary
                save_world(world)

        # Phase 4: prophecy check (may call LLM, NO lock)
        if world:
            current_day = world.current_day
            prophecy_events = await check_and_fulfill_prophecies(
                world, events, current_day
            )
            if prophecy_events:
                async with lock:
                    world = load_world(world_id)
                    if world:
                        world.events.extend(prophecy_events)
                        events.extend(prophecy_events)
                        # Re-apply fulfilled flags (they were set on the old object)
                        fulfilled_ids = {e.id.split("_prophecy_")[1] for e in prophecy_events if "_prophecy_" in e.id}
                        for p in world.prophecies:
                            if p.id in fulfilled_ids:
                                p.fulfilled = True
                                p.fulfilled_day = current_day
                                prophecy_fulfilled_data = {
                                    "text": p.text,
                                    "explanation": prophecy_events[0].description if prophecy_events else "",
                                    "day": current_day,
                                }
                        save_world(world)

        all_events.extend(events)

    # Notify linked Telegram chats with rich event data
    try:
        from telegram_bot import notify_linked_chats
        header = f"Day {world.current_day} — {len(all_events)} events"
        asyncio.create_task(notify_linked_chats(
            world_id,
            message=header,
            events=all_events,
            prophecy_fulfilled=prophecy_fulfilled_data,
        ))
    except Exception:
        pass

    return {
        "world_id": world_id,
        "days_simulated": actual_days,
        "current_day": world.current_day,
        "events": [e.model_dump() for e in all_events]
    }

@router.post("/{world_id}/simulate/quick")
async def run_quick_simulation(world_id: str, days: int = Query(default=1, ge=1, le=100)):
    """Simulate without LLM narrative generation (fast, for bulk advancement)."""
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    lock = get_lock(world_id)
    all_events = []
    actual_days = 0
    capped = min(days, 100)

    # Quick sim is CPU-only, lock per-day is fine
    for _ in range(capped):
        async with lock:
            world = load_world(world_id)
            if not world:
                break
            events = simulate_tick(world)
            world = load_world(world_id)
            actual_days += 1
            all_events.extend(events)

    # Notify linked Telegram chats (quick sim — no prophecy check)
    try:
        from telegram_bot import notify_linked_chats
        header = f"Quick sim — Day {world.current_day} — {len(all_events)} events"
        asyncio.create_task(notify_linked_chats(
            world_id,
            message=header,
            events=all_events,
        ))
    except Exception:
        pass

    return {
        "world_id": world_id,
        "days_simulated": actual_days,
        "current_day": world.current_day,
        "events": [e.model_dump() for e in all_events]
    }
