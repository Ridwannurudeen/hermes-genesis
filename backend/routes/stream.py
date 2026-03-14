import asyncio
import json
from fastapi import APIRouter, HTTPException, Query
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field
from generator import generate_world
from store import load_world, save_world, list_worlds, get_lock, creation_semaphore
from simulation import simulate_tick
from llm import chat_completion
from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt
from prophecy_checker import check_and_fulfill_prophecies
from config import MAX_WORLDS

router = APIRouter(prefix="/api/worlds", tags=["stream"])


class CreateWorldStreamRequest(BaseModel):
    seed: str = Field(..., min_length=3, max_length=2000)
    num_regions: int = Field(default=6, ge=3, le=12)
    num_factions: int = Field(default=4, ge=2, le=8)
    num_characters: int = Field(default=15, ge=6, le=30)


@router.post("/stream")
async def create_world_stream(req: CreateWorldStreamRequest):
    # Guard against unbounded world creation
    existing = list_worlds()
    if len(existing) >= MAX_WORLDS:
        raise HTTPException(429, f"Maximum {MAX_WORLDS} worlds reached. Delete old worlds first.")

    queue: asyncio.Queue = asyncio.Queue()

    async def on_progress(data: dict):
        await queue.put({"event": "progress", "data": json.dumps(data)})

    async def event_generator():
        await creation_semaphore.acquire()
        try:
            task = asyncio.create_task(
                generate_world(
                    req.seed,
                    req.num_regions,
                    req.num_factions,
                    req.num_characters,
                    on_progress=on_progress,
                )
            )
            while not task.done():
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield msg
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
            # Drain remaining messages
            while not queue.empty():
                yield await queue.get()

            try:
                world = task.result()
            except Exception as e:
                yield {"event": "error", "data": json.dumps({"message": str(e)})}
                return
            yield {
                "event": "complete",
                "data": json.dumps(
                    {"id": world.id, "name": world.name, "status": world.status}
                ),
            }
        finally:
            creation_semaphore.release()

    return EventSourceResponse(event_generator())


@router.post("/{world_id}/simulate/stream")
async def simulate_stream(world_id: str, days: int = Query(default=1, ge=1, le=30)):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    async def event_generator():
        nonlocal world
        lock = get_lock(world_id)
        for d in range(min(days, 30)):
            # Phase 1: simulate under lock (fast, CPU-only)
            async with lock:
                events = simulate_tick(world)
                world = load_world(world_id)
                world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"
                save_world(world)

            # Phase 2: narrate ALL events in parallel (NO lock)
            async def _narrate(evt):
                if evt.type != "death":
                    try:
                        narrative = await chat_completion(
                            NARRATOR_SYSTEM,
                            event_prompt(evt.model_dump(), world_ctx),
                            max_tokens=300,
                        )
                        evt.narrative = narrative.strip()
                    except Exception:
                        evt.narrative = evt.title

            await asyncio.gather(*[_narrate(evt) for evt in events])

            # Phase 3: merge narratives under lock (fast write)
            async with lock:
                world = load_world(world_id)
                for event in events:
                    if event.narrative:
                        for e in world.events:
                            if e.id == event.id:
                                e.narrative = event.narrative
                save_world(world)

            # Phase 4: prophecy check (may call LLM, NO lock)
            current_day = world.current_day
            prophecy_events = await check_and_fulfill_prophecies(
                world, events, current_day
            )

            # Phase 5: merge prophecy results under lock (fast write)
            if prophecy_events:
                async with lock:
                    world = load_world(world_id)
                    world.events.extend(prophecy_events)
                    events.extend(prophecy_events)
                    # Re-apply fulfilled flags (they were set on the old object)
                    fulfilled_ids = {e.id.split("_prophecy_")[1] for e in prophecy_events if "_prophecy_" in e.id}
                    for p in world.prophecies:
                        if p.id in fulfilled_ids:
                            p.fulfilled = True
                            p.fulfilled_day = current_day
                    save_world(world)

            # Yield outside the lock so we don't hold it during client I/O
            for event in events:
                yield {
                    "event": "sim_event",
                    "data": json.dumps(event.model_dump(), default=str),
                }
            yield {
                "event": "day_complete",
                "data": json.dumps(
                    {"day": world.current_day, "event_count": len(events)}
                ),
            }

        yield {
            "event": "complete",
            "data": json.dumps(
                {"world_id": world_id, "current_day": world.current_day}
            ),
        }

    return EventSourceResponse(event_generator())
