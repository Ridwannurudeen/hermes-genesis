from fastapi import APIRouter, HTTPException
from store import load_world, save_world
from simulation import simulate_tick
from llm import chat_completion, extract_json
from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt
from prompts.obituary import SYSTEM as OBITUARY_SYSTEM, obituary_prompt
from prompts.prophecy import CHECK_SYSTEM as PROPHECY_CHECK_SYSTEM, check_prophecies_prompt

router = APIRouter(prefix="/api/worlds", tags=["simulation"])

@router.post("/{world_id}/simulate")
async def run_simulation(world_id: str, days: int = 1):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    all_events = []
    for _ in range(min(days, 30)):
        events = simulate_tick(world)
        world = load_world(world_id)

        world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"
        for event in events:
            if event.type != "death":
                try:
                    narrative = await chat_completion(NARRATOR_SYSTEM, event_prompt(event.model_dump(), world_ctx), max_tokens=300)
                    event.narrative = narrative.strip()
                    for e in world.events:
                        if e.id == event.id:
                            e.narrative = event.narrative
                except Exception:
                    event.narrative = event.title

            # Generate obituary for death events
            if event.type == "death" and event.actors:
                char_id = event.actors[0]
                char = next((c for c in world.characters if c.id == char_id), None)
                if char:
                    char_events = [e.model_dump() for e in world.events if char_id in e.actors]
                    try:
                        obit = await chat_completion(
                            OBITUARY_SYSTEM,
                            obituary_prompt(char.model_dump(), char_events, world_ctx),
                            max_tokens=200
                        )
                        event.obituary = obit.strip()
                        for e in world.events:
                            if e.id == event.id:
                                e.obituary = obit.strip()
                    except Exception:
                        pass

        # Check prophecy fulfillment
        unfulfilled = [p.model_dump() for p in world.prophecies if not p.fulfilled]
        if unfulfilled and events:
            try:
                check_raw = await chat_completion(PROPHECY_CHECK_SYSTEM, check_prophecies_prompt(
                    unfulfilled,
                    [e.model_dump() for e in events],
                ), max_tokens=500)
                check_data = extract_json(check_raw)
                for r in check_data.get("results", []):
                    if r.get("fulfilled"):
                        for p in world.prophecies:
                            if p.id == r["prophecy_id"]:
                                p.fulfilled = True
                                p.fulfilled_day = world.current_day
                                p.fulfilled_event_id = r.get("matching_event_id", "")
            except Exception:
                pass

        save_world(world)
        all_events.extend(events)

    # Notify linked Telegram chats
    try:
        from telegram_bot import notify_linked_chats
        summary = f"\u2694\ufe0f Day {world.current_day} \u2014 {len(all_events)} events\n"
        for ev in all_events[:5]:
            summary += f"\u2022 {ev.title}\n"
        if len(all_events) > 5:
            summary += f"... and {len(all_events) - 5} more"
        import asyncio
        asyncio.create_task(notify_linked_chats(world_id, summary))
    except Exception:
        pass  # Don't fail simulation if notification fails

    return {
        "world_id": world_id,
        "days_simulated": days,
        "current_day": world.current_day,
        "events": [e.model_dump() for e in all_events]
    }

@router.post("/{world_id}/simulate/quick")
async def run_quick_simulation(world_id: str, days: int = 1):
    """Simulate without LLM narrative generation (fast, for bulk advancement)."""
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    all_events = []
    for _ in range(min(days, 100)):
        events = simulate_tick(world)
        world = load_world(world_id)
        all_events.extend(events)

    # Notify linked Telegram chats
    try:
        from telegram_bot import notify_linked_chats
        summary = f"\u2694\ufe0f Day {world.current_day} \u2014 {len(all_events)} events\n"
        for ev in all_events[:5]:
            summary += f"\u2022 {ev.title}\n"
        if len(all_events) > 5:
            summary += f"... and {len(all_events) - 5} more"
        import asyncio
        asyncio.create_task(notify_linked_chats(world_id, summary))
    except Exception:
        pass  # Don't fail simulation if notification fails

    return {
        "world_id": world_id,
        "days_simulated": days,
        "current_day": world.current_day,
        "events": [e.model_dump() for e in all_events]
    }
