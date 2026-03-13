from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from store import list_worlds, load_world, save_world, delete_world
from generator import generate_world
from models.genome import TRAITS
from models.event import Event, EventOutcome
from llm import chat_completion, extract_json
from prompts.chronicle import SYSTEM as CHRONICLE_SYSTEM, chronicle_prompt
from prompts.intervention import SYSTEM as INTERVENTION_SYSTEM, intervention_prompt
from prompts.character_chat import build_character_system
from prompts.council import SYSTEM as COUNCIL_SYSTEM, council_prompt

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

@router.get("/{world_id}/prophecies")
async def get_prophecies(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return [p.model_dump() for p in world.prophecies]

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

@router.post("/{world_id}/chronicle")
async def generate_chronicle(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    prompt = chronicle_prompt(
        world.name,
        world.seed,
        [e.model_dump() for e in world.events],
        [c.model_dump() for c in world.characters],
        [f.model_dump() for f in world.factions],
        world.current_day,
    )

    chronicle = await chat_completion(CHRONICLE_SYSTEM, prompt, max_tokens=4000)

    return {
        "chronicle": chronicle.strip(),
        "world_name": world.name,
        "current_day": world.current_day,
    }

class InterveneRequest(BaseModel):
    command: str

@router.post("/{world_id}/intervene")
async def divine_intervention(world_id: str, req: InterveneRequest):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    prompt = intervention_prompt(
        req.command,
        world.name,
        world.seed,
        world.current_day,
        [r.model_dump() for r in world.geography.regions],
        [f.model_dump() for f in world.factions],
        [c.model_dump() for c in world.characters],
    )

    raw = await chat_completion(INTERVENTION_SYSTEM, prompt, max_tokens=1000)
    data = extract_json(raw)

    # Create event
    event = Event(
        id=f"evt_{world.current_day:03d}_divine_{len(world.events)}",
        day=world.current_day,
        type="divine_intervention",
        title=data.get("title", "Divine Intervention"),
        description=data.get("description", ""),
        narrative=data.get("narrative", ""),
        actors=data.get("actors", []),
        factions_involved=data.get("factions_involved", []),
        regions_affected=data.get("regions_affected", []),
    )

    # Apply effects
    effects = data.get("effects", {})

    # Morale changes
    for fid, change in effects.get("morale_changes", {}).items():
        for f in world.factions:
            if f.id == fid:
                f.morale = max(0, min(100, f.morale + change))

    # Casualties
    for fid, count in effects.get("casualties", {}).items():
        for f in world.factions:
            if f.id == fid:
                f.population = max(0, f.population - count)

    # Character deaths
    for cid in effects.get("character_deaths", []):
        for c in world.characters:
            if c.id == cid:
                c.alive = False

    # Territory changes
    for rid, new_fid in effects.get("territory_changes", {}).items():
        for r in world.geography.regions:
            if r.id == rid:
                # Remove from old faction
                old_fid = r.controlled_by
                if old_fid:
                    for f in world.factions:
                        if f.id == old_fid and rid in f.territory:
                            f.territory.remove(rid)
                # Add to new faction
                r.controlled_by = new_fid
                for f in world.factions:
                    if f.id == new_fid and rid not in f.territory:
                        f.territory.append(rid)

    world.events.append(event)
    save_world(world)

    return {
        "event": event.model_dump(),
        "effects_applied": effects,
    }

class ChatRequest(BaseModel):
    message: str

@router.post("/{world_id}/characters/{char_id}/chat")
async def chat_with_character(world_id: str, char_id: str, req: ChatRequest):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    char = next((c for c in world.characters if c.id == char_id), None)
    if not char:
        raise HTTPException(404, "Character not found")

    faction = next((f for f in world.factions if f.id == char.faction_id), None)
    faction_name = faction.name if faction else "Unknown"

    system = build_character_system(
        char.model_dump(),
        world.name,
        faction_name,
        [e.model_dump() for e in world.events],
    )

    reply = await chat_completion(system, req.message, max_tokens=300, temperature=0.85)

    return {
        "reply": reply.strip(),
        "character_name": char.name,
        "character_id": char.id,
    }

@router.post("/{world_id}/council")
async def faction_council(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    prompt = council_prompt(
        world.name,
        world.current_day,
        [f.model_dump() for f in world.factions],
        [c.model_dump() for c in world.characters],
        [e.model_dump() for e in world.events],
    )

    raw = await chat_completion(COUNCIL_SYSTEM, prompt, max_tokens=2000)
    data = extract_json(raw)

    return data


@router.delete("/{world_id}")
async def remove_world(world_id: str):
    if delete_world(world_id):
        return {"deleted": True}
    raise HTTPException(404, "World not found")
