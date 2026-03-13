from fastapi import APIRouter, HTTPException
from store import load_world, save_world
from simulation import simulate_tick
from llm import chat_completion
from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt
from prompts.obituary import SYSTEM as OBITUARY_SYSTEM, obituary_prompt
from prophecy_checker import check_and_fulfill_prophecies

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

        # Check prophecy fulfillment and create fulfillment events
        prophecy_events = await check_and_fulfill_prophecies(
            world, events, world.current_day
        )
        if prophecy_events:
            world.events.extend(prophecy_events)
            events.extend(prophecy_events)

        save_world(world)
        all_events.extend(events)

    # Check for prophecy fulfillment to include in notification
    prophecy_fulfilled_data = None
    for p in getattr(world, "prophecies", []):
        if p.fulfilled and p.fulfilled_day == world.current_day:
            matching = [e for e in all_events if e.type == "prophecy_fulfilled"]
            prophecy_fulfilled_data = {
                "text": p.text,
                "explanation": matching[0].description if matching else "",
                "day": world.current_day,
            }
            break

    # Notify linked Telegram chats with rich event data
    try:
        from telegram_bot import notify_linked_chats
        import asyncio
        header = f"Day {world.current_day} \u2014 {len(all_events)} events"
        asyncio.create_task(notify_linked_chats(
            world_id,
            message=header,
            events=all_events,
            prophecy_fulfilled=prophecy_fulfilled_data,
        ))
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

    # Notify linked Telegram chats with rich event data (quick sim — no prophecy check)
    try:
        from telegram_bot import notify_linked_chats
        import asyncio
        header = f"Quick sim \u2014 Day {world.current_day} \u2014 {len(all_events)} events"
        asyncio.create_task(notify_linked_chats(
            world_id,
            message=header,
            events=all_events,
        ))
    except Exception:
        pass  # Don't fail simulation if notification fails

    return {
        "world_id": world_id,
        "days_simulated": days,
        "current_day": world.current_day,
        "events": [e.model_dump() for e in all_events]
    }
