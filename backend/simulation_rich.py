"""Rich simulation helper — shared between API routes and Telegram bot.

Runs simulate_tick + narrator + obituary + prophecy fulfillment in one call.
"""
from store import load_world, save_world
from simulation import simulate_tick
from llm import chat_completion
from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt
from prompts.obituary import SYSTEM as OBITUARY_SYSTEM, obituary_prompt
from prophecy_checker import check_and_fulfill_prophecies


async def simulate_rich_tick(world_id: str) -> tuple:
    """Simulate 1 day with full narrative, obituaries, and prophecy checks.

    Returns (world, events, prophecy_fulfilled_data).
    """
    world = load_world(world_id)
    if not world:
        return None, [], None

    events = simulate_tick(world)
    world = load_world(world_id)

    world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"

    for event in events:
        if event.type != "death":
            try:
                narrative = await chat_completion(
                    NARRATOR_SYSTEM, event_prompt(event.model_dump(), world_ctx),
                    max_tokens=300,
                )
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
                        max_tokens=200,
                    )
                    event.obituary = obit.strip()
                    for e in world.events:
                        if e.id == event.id:
                            e.obituary = obit.strip()
                except Exception:
                    pass

    # Check prophecy fulfillment
    prophecy_events = await check_and_fulfill_prophecies(
        world, events, world.current_day
    )
    if prophecy_events:
        world.events.extend(prophecy_events)
        events.extend(prophecy_events)

    save_world(world)

    # Build prophecy fulfilled data if any
    prophecy_fulfilled_data = None
    for p in getattr(world, "prophecies", []):
        if p.fulfilled and p.fulfilled_day == world.current_day:
            matching = [e for e in events if e.type == "prophecy_fulfilled"]
            prophecy_fulfilled_data = {
                "text": p.text,
                "explanation": matching[0].description if matching else "",
                "day": world.current_day,
            }
            break

    return world, events, prophecy_fulfilled_data
