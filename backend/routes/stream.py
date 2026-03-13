import asyncio
import json
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from generator import generate_world
from store import load_world, save_world
from simulation import simulate_tick
from llm import chat_completion, extract_json
from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt
from prompts.prophecy import CHECK_SYSTEM as PROPHECY_CHECK_SYSTEM, check_prophecies_prompt

router = APIRouter(prefix="/api/worlds", tags=["stream"])


class CreateWorldStreamRequest(BaseModel):
    seed: str
    num_regions: int = 6
    num_factions: int = 4
    num_characters: int = 15


@router.post("/stream")
async def create_world_stream(req: CreateWorldStreamRequest):
    queue: asyncio.Queue = asyncio.Queue()

    async def on_progress(data: dict):
        await queue.put({"event": "progress", "data": json.dumps(data)})

    async def event_generator():
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

    return EventSourceResponse(event_generator())


@router.post("/{world_id}/simulate/stream")
async def simulate_stream(world_id: str, days: int = 1):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    async def event_generator():
        nonlocal world
        for d in range(min(days, 30)):
            events = simulate_tick(world)
            world = load_world(world_id)
            world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"

            for event in events:
                if event.type != "death":
                    try:
                        narrative = await chat_completion(
                            NARRATOR_SYSTEM,
                            event_prompt(event.model_dump(), world_ctx),
                            max_tokens=300,
                        )
                        event.narrative = narrative.strip()
                        for e in world.events:
                            if e.id == event.id:
                                e.narrative = event.narrative
                    except Exception:
                        event.narrative = event.title

                yield {
                    "event": "sim_event",
                    "data": json.dumps(event.model_dump(), default=str),
                }

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
