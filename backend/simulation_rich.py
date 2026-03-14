"""Rich simulation helper — shared between API routes and Telegram bot.

Runs simulate_tick + narrator + obituary + prophecy fulfillment in one call.
Uses phased locking: hold lock only for fast mutations, release during LLM calls.
"""
from store import load_world, save_world, get_lock
from simulation import simulate_tick
from llm import chat_completion
from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt
from prompts.obituary import SYSTEM as OBITUARY_SYSTEM, obituary_prompt
from prophecy_checker import check_and_fulfill_prophecies


async def simulate_rich_tick(world_id: str) -> tuple:
    """Simulate 1 day with full narrative, obituaries, and prophecy checks.

    Lock strategy: hold per-world lock only for fast mutation phases.
    Release during slow LLM calls so other endpoints aren't blocked.

    Returns (world, events, prophecy_fulfilled_data).
    """
    lock = get_lock(world_id)

    # --- Phase 1: simulate under lock (fast, CPU-only) ---
    async with lock:
        world = load_world(world_id)
        if not world:
            return None, [], None
        events = simulate_tick(world)
        world = load_world(world_id)
        world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"
        save_world(world)

    # --- Phase 2: narrate + obituary (slow LLM calls, NO lock) ---
    for event in events:
        if event.type != "death":
            try:
                narrative = await chat_completion(
                    NARRATOR_SYSTEM, event_prompt(event.model_dump(), world_ctx),
                    max_tokens=300,
                )
                event.narrative = narrative.strip()
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
                except Exception:
                    pass

    # --- Phase 3: merge narratives under lock (fast write) ---
    async with lock:
        world = load_world(world_id)
        if world:
            for event in events:
                for e in world.events:
                    if e.id == event.id:
                        if event.narrative:
                            e.narrative = event.narrative
                        if getattr(event, "obituary", None):
                            e.obituary = event.obituary
            save_world(world)

    # --- Phase 4: prophecy check (may call LLM, NO lock) ---
    prophecy_fulfilled_data = None
    if world:
        current_day = world.current_day
        prophecy_events = await check_and_fulfill_prophecies(
            world, events, current_day
        )

        # --- Phase 5: merge prophecy results under lock (fast write) ---
        if prophecy_events:
            async with lock:
                world = load_world(world_id)
                if world:
                    world.events.extend(prophecy_events)
                    events.extend(prophecy_events)
                    # Re-apply fulfilled flags (set on old in-memory object)
                    fulfilled_ids = {
                        e.id.split("_prophecy_")[1]
                        for e in prophecy_events
                        if "_prophecy_" in e.id
                    }
                    for p in world.prophecies:
                        if p.id in fulfilled_ids:
                            p.fulfilled = True
                            p.fulfilled_day = current_day
                    save_world(world)

    # Build prophecy fulfilled data if any
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
