import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from store import list_worlds, load_world, save_world, delete_world, get_lock, cleanup_lock, creation_semaphore
from generator import generate_world
from models.genome import TRAITS
from models.event import Event, EventOutcome
from llm import chat_completion, extract_json
from prompts.chronicle import SYSTEM as CHRONICLE_SYSTEM, chronicle_prompt
from prompts.intervention import SYSTEM as INTERVENTION_SYSTEM, intervention_prompt
from prompts.character_chat import build_character_system
from prompts.council import SYSTEM as COUNCIL_SYSTEM, council_prompt
from prompts.campaign_kit import SYSTEM as CAMPAIGN_SYSTEM, campaign_kit_prompt
from prompts.session_prep import SYSTEM as SESSION_PREP_SYSTEM, session_prep_prompt
from autonomous_agent import start_agent, stop_agent, is_agent_running, get_agent_logs, cleanup_agent_state
from simulation import repair_leadership

router = APIRouter(prefix="/api/worlds", tags=["worlds"])

class CreateWorldRequest(BaseModel):
    seed: str = Field(..., min_length=3, max_length=2000)
    num_regions: int = Field(default=4, ge=3, le=12)
    num_factions: int = Field(default=3, ge=2, le=8)
    num_characters: int = Field(default=8, ge=4, le=30)

@router.get("")
async def get_worlds():
    return list_worlds()

@router.post("")
async def create_world(req: CreateWorldRequest):
    from config import MAX_WORLDS
    existing = list_worlds()
    if len(existing) >= MAX_WORLDS:
        raise HTTPException(429, f"Maximum {MAX_WORLDS} worlds reached. Delete old worlds first.")
    async with creation_semaphore:
        # Re-check after acquiring semaphore (another creation may have finished)
        if len(list_worlds()) >= MAX_WORLDS:
            raise HTTPException(429, f"Maximum {MAX_WORLDS} worlds reached. Delete old worlds first.")
        world = await generate_world(req.seed, req.num_regions, req.num_factions, req.num_characters)
    return {"id": world.id, "name": world.name, "status": world.status}

@router.get("/{world_id}")
async def get_world(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    data = world.model_dump()
    # Exclude heavy fields — fetched via dedicated endpoints
    data.pop("events", None)
    data.pop("agent_logs", None)
    return data

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
async def get_events(world_id: str, day: int | None = None, limit: int = 50, offset: int = 0):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    events = world.events
    if day is not None:
        events = [e for e in events if e.day == day]
    total = len(events)
    # Most recent first
    events = list(reversed(events))
    events = events[offset:offset + limit]
    return {"events": [e.model_dump() for e in events], "total": total}

@router.get("/{world_id}/prophecies")
async def get_prophecies(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return [p.model_dump() for p in world.prophecies]

@router.get("/{world_id}/export")
async def export_world(world_id: str):
    """Export full world as formatted Markdown for TTRPG, writing, or education use."""
    from fastapi.responses import PlainTextResponse
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    faction_map = {f.id: f.name for f in world.factions}
    char_map = {c.id: c.name for c in world.characters}
    region_map = {r.id: r.name for r in world.geography.regions}

    lines = []
    lines.append(f"# {world.name}")
    lines.append(f"\n> *\"{world.seed}\"*")
    lines.append(f"\n**Day**: {world.current_day} | **Theme**: {world.theme or 'Fantasy'}")
    if world.rules.conflict_driver:
        lines.append(f"**Conflict Driver**: {world.rules.conflict_driver}")
    lines.append("")

    # Geography
    lines.append("---\n\n## Geography\n")
    for r in world.geography.regions:
        ctrl = faction_map.get(r.controlled_by, "Unclaimed")
        lines.append(f"### {r.name}")
        lines.append(f"- **Type**: {r.type} | **Controlled by**: {ctrl}")
        if r.description:
            lines.append(f"- {r.description}")
        if r.resources:
            lines.append(f"- **Resources**: {', '.join(r.resources)}")
        lines.append("")

    # Factions
    lines.append("---\n\n## Factions\n")
    for f in world.factions:
        leader = char_map.get(f.leader_id, "None")
        allies = ", ".join(faction_map.get(a, a) for a in f.alliances) or "None"
        enemies = ", ".join(faction_map.get(e, e) for e in f.enemies) or "None"
        territory = ", ".join(region_map.get(t, t) for t in f.territory) or "None"
        lines.append(f"### {f.name}")
        lines.append(f"- **Ideology**: {f.ideology}")
        if f.description:
            lines.append(f"- {f.description}")
        lines.append(f"- **Leader**: {leader} | **Population**: {f.population:,} | **Morale**: {f.morale}/100")
        lines.append(f"- **Territory**: {territory}")
        lines.append(f"- **Allies**: {allies} | **Enemies**: {enemies}")
        if f.traits:
            lines.append(f"- **Traits**: {', '.join(f.traits)}")
        lines.append("")

    # Characters
    alive = [c for c in world.characters if c.alive]
    dead = [c for c in world.characters if not c.alive]
    lines.append(f"---\n\n## Characters ({len(alive)} alive, {len(dead)} dead)\n")
    for c in alive:
        faction = faction_map.get(c.faction_id, "Unknown")
        location = region_map.get(c.location, c.location)
        g = c.genome
        lines.append(f"### {c.name}")
        lines.append(f"- **Role**: {c.role} | **Faction**: {faction} | **Age**: {c.age} | **Location**: {location}")
        lines.append(f"- **Genome**: COU {g.courage:.2f} / CUN {g.cunning:.2f} / LOY {g.loyalty:.2f} / AMB {g.ambition:.2f} / EMP {g.empathy:.2f} / RES {g.resilience:.2f}")
        lines.append(f"- **Fitness**: {c.fitness:.2f} | **Generation**: {c.lineage.generation}")
        if c.backstory:
            lines.append(f"- {c.backstory}")
        if c.goals:
            lines.append(f"- **Goals**: {'; '.join(c.goals)}")
        lines.append("")

    if dead:
        lines.append("### Fallen Characters\n")
        for c in dead:
            lines.append(f"- **{c.name}** — {c.role} of {faction_map.get(c.faction_id, 'Unknown')}, Gen {c.lineage.generation}")
        lines.append("")

    # Prophecies
    if world.prophecies:
        lines.append("---\n\n## Prophecies\n")
        for p in world.prophecies:
            status = f"Fulfilled (Day {p.fulfilled_day})" if p.fulfilled else "Unfulfilled"
            lines.append(f"- *\"{p.text}\"* — **{status}**")
        lines.append("")

    # Event Chronicle (last 100)
    lines.append(f"---\n\n## Chronicle ({len(world.events)} events)\n")
    for e in world.events[-100:]:
        actors = ", ".join(char_map.get(a, a) for a in e.actors) if e.actors else ""
        factions_str = ", ".join(faction_map.get(f, f) for f in e.factions_involved) if e.factions_involved else ""
        lines.append(f"#### Day {e.day} — {e.title}")
        lines.append(f"*{e.type.replace('_', ' ').title()}*")
        if actors:
            lines.append(f"**Actors**: {actors}")
        if factions_str:
            lines.append(f"**Factions**: {factions_str}")
        if e.narrative:
            lines.append(f"\n{e.narrative}")
        lines.append("")

    md = "\n".join(lines)
    return PlainTextResponse(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{world.name.replace(" ", "_")}.md"'},
    )


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
    command: str = Field(..., min_length=3, max_length=2000)

@router.post("/{world_id}/intervene")
async def divine_intervention(world_id: str, req: InterveneRequest):
    # Phase 1: snapshot world state for prompt (no lock needed)
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

    # Phase 2: LLM call (slow, NO lock — don't block other endpoints)
    raw = await chat_completion(INTERVENTION_SYSTEM, prompt, max_tokens=1000)
    data = extract_json(raw)

    # Phase 3: apply effects under lock (fast mutations only)
    lock = get_lock(world_id)
    async with lock:
        # Re-load latest state so we merge cleanly
        world = load_world(world_id)
        if not world:
            raise HTTPException(404, "World not found")

        # Validate entity IDs from LLM output — drop any that don't exist
        valid_char_ids = {c.id for c in world.characters}
        valid_faction_ids = {f.id for f in world.factions}
        valid_region_ids = {r.id for r in world.geography.regions}

        event = Event(
            id=f"evt_{world.current_day:03d}_divine_{len(world.events)}",
            day=world.current_day,
            type="divine_intervention",
            title=data.get("title", "Divine Intervention"),
            description=data.get("description", ""),
            narrative=data.get("narrative", ""),
            actors=[a for a in data.get("actors", []) if isinstance(a, str) and a in valid_char_ids],
            factions_involved=[f for f in data.get("factions_involved", []) if isinstance(f, str) and f in valid_faction_ids],
            regions_affected=[r for r in data.get("regions_affected", []) if isinstance(r, str) and r in valid_region_ids],
            agent_triggered=False,
            user_triggered=True,
        )

        effects = data.get("effects", {})
        if not isinstance(effects, dict):
            effects = {}

        for fid, change in effects.get("morale_changes", {}).items():
            if not isinstance(change, (int, float)):
                continue
            for f in world.factions:
                if f.id == fid:
                    f.morale = max(0, min(100, f.morale + int(change)))

        for fid, count in effects.get("casualties", {}).items():
            if not isinstance(count, (int, float)):
                continue
            for f in world.factions:
                if f.id == fid:
                    f.population = max(0, f.population - int(count))

        for cid in effects.get("character_deaths", []):
            if not isinstance(cid, str):
                continue
            for c in world.characters:
                if c.id == cid:
                    c.alive = False
                    repair_leadership(world, cid)

        for rid, new_fid in effects.get("territory_changes", {}).items():
            if not isinstance(new_fid, str):
                continue
            for r in world.geography.regions:
                if r.id == rid:
                    old_fid = r.controlled_by
                    if old_fid:
                        for f in world.factions:
                            if f.id == old_fid and rid in f.territory:
                                f.territory.remove(rid)
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
    message: str = Field(..., min_length=1, max_length=1000)

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


@router.post("/{world_id}/campaign-kit")
async def generate_campaign_kit(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    prompt = campaign_kit_prompt(
        world.name,
        world.seed,
        world.current_day,
        [r.model_dump() for r in world.geography.regions],
        [f.model_dump() for f in world.factions],
        [c.model_dump() for c in world.characters],
        [e.model_dump() for e in world.events],
        [p.model_dump() for p in getattr(world, 'prophecies', [])],
    )

    kit = await chat_completion(CAMPAIGN_SYSTEM, prompt, max_tokens=6000, temperature=0.8)

    return {
        "campaign_kit": kit.strip(),
        "world_name": world.name,
        "current_day": world.current_day,
    }


@router.post("/{world_id}/session-prep")
async def generate_session_prep(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    prompt = session_prep_prompt(
        world.name,
        world.seed,
        world.current_day,
        [r.model_dump() for r in world.geography.regions],
        [f.model_dump() for f in world.factions],
        [c.model_dump() for c in world.characters],
        [e.model_dump() for e in world.events],
    )

    session_plan = await chat_completion(SESSION_PREP_SYSTEM, prompt, max_tokens=4000, temperature=0.8)

    return {
        "session_plan": session_plan.strip(),
        "world_name": world.name,
        "current_day": world.current_day,
    }


@router.post("/{world_id}/agent/start")
async def start_world_agent(world_id: str, interval: int = 120):
    if interval < 30:
        raise HTTPException(400, "Interval must be at least 30 seconds")
    if interval > 3600:
        raise HTTPException(400, "Interval must be at most 3600 seconds")
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    result = start_agent(world_id, interval)
    if result == "already_running":
        raise HTTPException(409, "Agent already running for this world")
    if result == "max_agents_reached":
        raise HTTPException(429, "Maximum concurrent agents reached. Stop another agent first.")
    return {"started": True, "world_id": world_id, "interval": interval}

@router.post("/{world_id}/agent/stop")
async def stop_world_agent(world_id: str):
    stop_agent(world_id)
    return {"stopped": True, "world_id": world_id}

@router.get("/{world_id}/agent/status")
async def agent_status(world_id: str):
    return {
        "running": is_agent_running(world_id),
        "world_id": world_id,
        "log_count": len(get_agent_logs(world_id)),
    }

@router.get("/{world_id}/agent/logs")
async def agent_logs(world_id: str):
    # Get in-memory logs (may be newer than persisted)
    in_memory = get_agent_logs(world_id)

    # Load persisted logs from world data
    world = load_world(world_id)
    if not world:
        return in_memory

    persisted = world.agent_logs or []

    # If no in-memory logs, return persisted
    if not in_memory:
        return persisted

    # If no persisted logs, return in-memory
    if not persisted:
        return in_memory

    # Merge: use persisted as base, append any in-memory entries that are newer
    # Compare by timestamp -- in-memory entries after the last persisted timestamp are new
    last_persisted_ts = persisted[-1].get("timestamp", "")
    newer = [log for log in in_memory if log.get("timestamp", "") > last_persisted_ts]

    if newer:
        merged = persisted + newer
        # Cap at 100 for the response
        return merged[-100:]

    # Persisted is up-to-date or superset -- return whichever is longer
    return persisted if len(persisted) >= len(in_memory) else in_memory


@router.delete("/{world_id}")
async def remove_world(world_id: str):
    # Stop any running agent before deleting world data
    if is_agent_running(world_id):
        stop_agent(world_id)
    # Acquire per-world lock so we don't delete while a sim/agent is mid-write
    lock = get_lock(world_id)
    async with lock:
        deleted = delete_world(world_id)
    # Clean up lock entry AFTER releasing (no coroutine holds the old object now)
    if deleted:
        cleanup_lock(world_id)
        cleanup_agent_state(world_id)
        return {"deleted": True}
    raise HTTPException(404, "World not found")
