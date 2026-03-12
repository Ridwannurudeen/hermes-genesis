from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from store import list_worlds, load_world, save_world, delete_world
from generator import generate_world
from models.genome import TRAITS

router = APIRouter(prefix="/api/worlds", tags=["worlds"])

class CreateWorldRequest(BaseModel):
    seed: str
    num_regions: int = 6
    num_factions: int = 4
    num_characters: int = 15

@router.get("")
async def get_worlds():
    return list_worlds()

@router.post("")
async def create_world(req: CreateWorldRequest):
    world = await generate_world(req.seed, req.num_regions, req.num_factions, req.num_characters)
    return {"id": world.id, "name": world.name, "status": world.status}

@router.get("/{world_id}")
async def get_world(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return world.model_dump()

@router.get("/{world_id}/map")
async def get_map(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    factions = {f.id: {"name": f.name, "color": f.color} for f in world.factions}
    return {"geography": world.geography.model_dump(), "factions": factions}

@router.get("/{world_id}/factions")
async def get_factions(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return [f.model_dump() for f in world.factions]

@router.get("/{world_id}/characters")
async def get_characters(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return [c.model_dump() for c in world.characters]

@router.get("/{world_id}/characters/{char_id}")
async def get_character(world_id: str, char_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    char = next((c for c in world.characters if c.id == char_id), None)
    if not char:
        raise HTTPException(404, "Character not found")
    return char.model_dump()

@router.get("/{world_id}/events")
async def get_events(world_id: str, day: int | None = None):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    events = world.events
    if day is not None:
        events = [e for e in events if e.day == day]
    return [e.model_dump() for e in events]

@router.get("/{world_id}/evolution")
async def get_evolution(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    gen_stats = {}
    for c in world.characters:
        gen = c.lineage.generation
        if gen not in gen_stats:
            gen_stats[gen] = {t: [] for t in TRAITS}
            gen_stats[gen]["_count"] = 0
        gen_stats[gen]["_count"] += 1
        for t in TRAITS:
            gen_stats[gen][t].append(getattr(c.genome, t))
    result = []
    for gen, stats in sorted(gen_stats.items()):
        entry = {"generation": gen, "count": stats["_count"]}
        for t in TRAITS:
            entry[t] = round(sum(stats[t]) / len(stats[t]), 3) if stats[t] else 0
        result.append(entry)
    return result

@router.get("/{world_id}/faction-timeline")
async def get_faction_timeline(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return world.faction_snapshots

@router.delete("/{world_id}")
async def remove_world(world_id: str):
    if delete_world(world_id):
        return {"deleted": True}
    raise HTTPException(404, "World not found")
