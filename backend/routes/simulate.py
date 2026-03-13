from fastapi import APIRouter, HTTPException
from store import load_world, save_world
from simulation import simulate_tick
from simulation_rich import simulate_rich_tick

router = APIRouter(prefix="/api/worlds", tags=["simulation"])

@router.post("/{world_id}/simulate")
async def run_simulation(world_id: str, days: int = 1):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    all_events = []
    prophecy_fulfilled_data = None

    for _ in range(min(days, 30)):
        world, events, pf_data = await simulate_rich_tick(world_id)
        if not world:
            break
        all_events.extend(events)
        if pf_data:
            prophecy_fulfilled_data = pf_data

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
        pass

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

    # Notify linked Telegram chats (quick sim — no prophecy check)
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
        pass

    return {
        "world_id": world_id,
        "days_simulated": days,
        "current_day": world.current_day,
        "events": [e.model_dump() for e in all_events]
    }
