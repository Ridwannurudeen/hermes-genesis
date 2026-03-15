import asyncio
import json
import logging
from datetime import datetime, timezone
from config import DATA_DIR
from store import load_world, save_world, list_worlds, get_lock
from simulation import simulate_tick, repair_leadership as _repair_leader
from llm import chat_completion, extract_json

logger = logging.getLogger(__name__)

# In-memory state for running agents
_running_agents: dict[str, bool] = {}  # world_id -> active
_agent_logs: dict[str, list] = {}  # world_id -> list of log entries
_agent_plans: dict[str, str] = {}  # world_id -> current narrative arc/plan

AGENT_SYSTEM = """You are the World Master -- an autonomous AI agent governing a living fantasy world.
You observe the current state and decide what should happen next.

You have THREE actions available:
1. "simulate" -- Let the world run naturally. Use when tensions are building and you want organic events.
2. "intervene" -- Create a specific dramatic event. Use when you want to force a crisis, fulfill a prophecy, or create a turning point. You MUST provide intervention_command with a natural language description of what happens.
3. "focus" -- Run simulation but steer it toward a specific faction or character. Use when you want to develop a particular storyline.

Guidelines:
- Which factions are in tension? Who's growing too powerful?
- Are any characters near death (low fitness)? Any rising stars?
- What prophecies remain unfulfilled? Can you nudge events toward fulfillment?
- What would make the most compelling story right now?
- Don't let the world stagnate -- create drama, tension, consequences.
- Use "intervene" sparingly for high-impact moments. Most ticks should be "simulate" or "focus".
- When using "focus", always specify a valid faction_id or character_id from the world data.

Return ONLY valid JSON:
{
  "reasoning": "2-3 sentences analyzing current state and tensions",
  "action": "simulate|intervene|focus",
  "decision": "1 sentence describing your choice",
  "intervention_command": "what happens (required if action=intervene, null otherwise)",
  "focus_faction": "faction_id (if action=focus, null otherwise)",
  "focus_character": "character_id (if action=focus, null otherwise)",
  "narrative_arc": "the multi-day story you're building toward",
  "urgency": "low|medium|high"
}"""


def _get_last_action_consequences(world, world_id: str) -> str:
    """Build a consequence feedback string from the agent's last action.

    Looks at the most recent agent log entry and finds events that resulted
    from it, giving the LLM visibility into the outcomes of its decisions.
    """
    # Find last log entry -- check in-memory first, then persisted
    last_log = None
    if world_id in _agent_logs and _agent_logs[world_id]:
        last_log = _agent_logs[world_id][-1]
    elif world.agent_logs:
        last_log = world.agent_logs[-1]

    if not last_log:
        return ""

    last_action = last_log.get("action", "simulate")
    last_day = last_log.get("day", 0)
    last_decision = last_log.get("decision", "")
    last_command = last_log.get("intervention_command")
    event_titles = last_log.get("event_titles", [])

    lines = []
    lines.append(f"Action: {last_action}")
    lines.append(f"Decision: {last_decision}")
    if last_command:
        lines.append(f"Command: {last_command}")

    # Show events that were generated from the last tick
    if event_titles:
        lines.append(f"Events produced ({len(event_titles)}):")
        for title in event_titles[:5]:
            lines.append(f"  - {title}")

    # Find events since the last agent tick day and show their outcomes
    consequence_events = [e for e in world.events if e.day >= last_day]
    if consequence_events:
        # Check for agent-triggered events and notable outcomes
        agent_events = [e for e in consequence_events if e.agent_triggered or e.caused_by]
        deaths = [e for e in consequence_events if e.type == "death"]
        interventions = [e for e in consequence_events if e.type == "divine_intervention"]

        if agent_events and last_action == "intervene":
            lines.append("Direct consequences of your intervention:")
            for e in agent_events[:3]:
                lines.append(f"  - [{e.type}] {e.title}")

        if deaths:
            lines.append(f"Deaths since your action: {', '.join(e.title for e in deaths[:3])}")
        if interventions and last_action != "intervene":
            lines.append(f"Interventions since: {', '.join(e.title for e in interventions[:3])}")

    return "\n".join(lines)


def _build_observation(world, world_id: str = "") -> str:
    """Build the observation prompt from world state."""
    faction_lines = []
    for f in world.factions:
        allies = ", ".join(f.alliances) if f.alliances else "none"
        enemies = ", ".join(f.enemies) if f.enemies else "none"
        faction_lines.append(
            f"- {f.name} ({f.id}): territory={len(f.territory)}, morale={f.morale}, "
            f"pop={f.population}, allies=[{allies}], enemies=[{enemies}]"
        )

    alive = [c for c in world.characters if c.alive]
    dead_count = sum(1 for c in world.characters if not c.alive)
    char_lines = []
    for c in sorted(alive, key=lambda x: x.fitness, reverse=True)[:15]:
        char_lines.append(
            f"- {c.name} ({c.id}): {c.role}, faction={c.faction_id}, "
            f"fitness={c.fitness:.2f}, location={c.location}"
        )

    recent = world.events[-10:] if world.events else []
    event_lines = [f"- Day {e.day}: [{e.type}] {e.title}" for e in recent]

    prophecy_lines = []
    for p in getattr(world, "prophecies", []):
        status = (
            f"FULFILLED (Day {p.fulfilled_day})" if p.fulfilled else "UNFULFILLED"
        )
        prophecy_lines.append(f'- [{status}] "{p.text}"')

    # Build consequence feedback from last action
    consequence_section = ""
    if world_id:
        consequences = _get_last_action_consequences(world, world_id)
        if consequences:
            consequence_section = f"""
CONSEQUENCES OF YOUR LAST ACTION:
{consequences}
Reflect on whether your last action achieved what you intended. Adjust your strategy accordingly.
"""

    return f"""World: "{world.name}" -- Day {world.current_day}
Seed: "{world.seed}"

FACTIONS ({len(world.factions)}):
{chr(10).join(faction_lines)}

TOP CHARACTERS ({len(alive)} alive, {dead_count} dead):
{chr(10).join(char_lines)}

RECENT EVENTS:
{chr(10).join(event_lines) if event_lines else "None yet"}

PROPHECIES:
{chr(10).join(prophecy_lines) if prophecy_lines else "None"}
{consequence_section}
What should happen next in this world? Analyze and decide."""


def _apply_intervention_effects(world, decision: dict, data: dict) -> tuple:
    """Apply pre-computed intervention effects to world state (fast, no LLM calls).
    Must be called under per-world lock. Returns (events, world)."""
    from models.event import Event

    next_day = world.current_day + 1
    world.current_day = next_day

    # Validate entity IDs from LLM output — drop any that don't exist
    valid_char_ids = {c.id for c in world.characters}
    valid_faction_ids = {f.id for f in world.factions}
    valid_region_ids = {r.id for r in world.geography.regions}

    event = Event(
        id=f"evt_{next_day:03d}_agent_{len(world.events)}",
        day=next_day,
        type="divine_intervention",
        title=data.get("title", "The World Master Acts"),
        description=data.get("description", ""),
        narrative=data.get("narrative", ""),
        actors=[a for a in data.get("actors", []) if isinstance(a, str) and a in valid_char_ids],
        factions_involved=[f for f in data.get("factions_involved", []) if isinstance(f, str) and f in valid_faction_ids],
        regions_affected=[r for r in data.get("regions_affected", []) if isinstance(r, str) and r in valid_region_ids],
        agent_triggered=True,
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
                _repair_leader(world, cid)

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

    for f in world.factions:
        world.faction_snapshots.append({
            "day": next_day,
            "faction_id": f.id,
            "territory_count": len(f.territory),
            "population": f.population,
            "morale": f.morale,
        })

    save_world(world)
    return [event], world


def _apply_focus_bias(world, decision: dict) -> None:
    """Bias world state slightly to steer simulation toward focused faction/character.
    Does NOT save — caller is responsible for saving after simulation."""
    focus_fid = decision.get("focus_faction")
    focus_cid = decision.get("focus_character")

    if focus_fid:
        for f in world.factions:
            if f.id == focus_fid:
                if decision.get("urgency") == "high":
                    f.morale = max(0, f.morale - 15)
                elif decision.get("urgency") == "medium":
                    f.morale = max(0, f.morale - 8)
                break

    if focus_cid:
        for c in world.characters:
            if c.id == focus_cid and c.alive:
                c.fitness = min(1.0, c.fitness + 0.15)
                break


async def agent_tick(world_id: str):
    """One autonomous agent tick: observe, reason, act based on LLM decision.

    Lock strategy: hold per-world lock only for fast mutation phases (simulate,
    apply effects, save).  Release during slow LLM calls (reasoning, narration,
    prophecy) so other endpoints aren't blocked.
    """
    lock = get_lock(world_id)

    # --- Phase 1: snapshot world state (fast read, no lock needed) ---
    world = load_world(world_id)
    if not world:
        return None

    observation = _build_observation(world, world_id)
    if world_id in _agent_plans:
        observation += f"\n\nYOUR PREVIOUS PLAN: {_agent_plans[world_id]}"
        observation += "\nContinue or revise this plan based on what has happened."

    # --- Phase 2: LLM reasoning (slow, NO lock) ---
    try:
        raw = await chat_completion(
            AGENT_SYSTEM, observation, max_tokens=600, temperature=0.9
        )
        decision = extract_json(raw)
    except Exception as e:
        logger.warning(f"Agent reasoning failed for {world_id}: {e}")
        decision = {
            "action": "simulate",
            "reasoning": "Could not analyze -- proceeding with standard simulation",
            "decision": "Run normal simulation tick",
            "narrative_arc": "unknown",
            "urgency": "medium",
        }

    action = decision.get("action", "simulate")
    if action not in ("simulate", "intervene", "focus"):
        logger.warning(f"Agent returned invalid action '{action}', falling back to simulate")
        action = "simulate"

    arc = decision.get("narrative_arc", "")
    if arc:
        _agent_plans[world_id] = arc

    # --- Phase 3: execute action ---
    events = []
    intervention_data = None

    # For interventions: run LLM call OUTSIDE lock, then apply under lock
    if action == "intervene" and decision.get("intervention_command"):
        try:
            from prompts.intervention import SYSTEM as _INT_SYSTEM, intervention_prompt as _int_prompt
            world = load_world(world_id)
            if not world:
                return None
            prompt = _int_prompt(
                decision.get("intervention_command", "Something dramatic happens"),
                world.name, world.seed, world.current_day,
                [r.model_dump() for r in world.geography.regions],
                [f.model_dump() for f in world.factions],
                [c.model_dump() for c in world.characters],
            )
            raw = await chat_completion(_INT_SYSTEM, prompt, max_tokens=1000)
            intervention_data = extract_json(raw)
        except Exception as e:
            logger.warning(f"Agent intervention LLM failed, falling back to simulate: {e}")
            action = "simulate"
            intervention_data = None

    # Mutate world under lock (fast)
    async with lock:
        world = load_world(world_id)
        if not world:
            return None

        if action == "intervene" and intervention_data is not None:
            try:
                events, world = _apply_intervention_effects(world, decision, intervention_data)
            except Exception as e:
                logger.warning(f"Agent intervention apply failed, falling back to simulate: {e}")
                action = "simulate"
                world = load_world(world_id)
                events = simulate_tick(world)
                world = load_world(world_id)
        elif action == "focus":
            _apply_focus_bias(world, decision)
            # simulate_tick mutates and saves the world
            events = simulate_tick(world)
            world = load_world(world_id)
        else:
            events = simulate_tick(world)
            world = load_world(world_id)

        world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"
        save_world(world)

    # --- Phase 4: narrate events (slow LLM calls, NO lock) ---
    from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt

    for event in events:
        if event.type != "death" and not event.narrative:
            try:
                narrative = await chat_completion(
                    NARRATOR_SYSTEM,
                    event_prompt(event.model_dump(), world_ctx),
                    max_tokens=300,
                )
                event.narrative = narrative.strip()
            except Exception:
                event.narrative = event.title

    # --- Phase 5: merge narratives under lock (fast) ---
    async with lock:
        world = load_world(world_id)
        if world:
            for event in events:
                if event.narrative:
                    for e in world.events:
                        if e.id == event.id:
                            e.narrative = event.narrative
            save_world(world)

    # --- Phase 5b: prophecy check (may call LLM, NO lock) ---
    prophecy_fulfilled_data = None
    try:
        from prophecy_checker import check_and_fulfill_prophecies

        current_day = world.current_day if world else 0
        prophecy_events = await check_and_fulfill_prophecies(
            world, events, current_day
        )
        if prophecy_events:
            # --- Phase 5c: merge prophecy results under lock (fast) ---
            async with lock:
                world = load_world(world_id)
                if world:
                    world.events.extend(prophecy_events)
                    events.extend(prophecy_events)
                    # Re-apply fulfilled flags (they were set on the old object)
                    fulfilled_ids = {parts[1] for e in prophecy_events if "_prophecy_" in e.id for parts in [e.id.split("_prophecy_", 1)] if len(parts) > 1}
                    for p in world.prophecies:
                        if p.id in fulfilled_ids:
                            p.fulfilled = True
                            p.fulfilled_day = current_day
                            prophecy_fulfilled_data = {
                                "text": p.text,
                                "explanation": prophecy_events[0].description if prophecy_events else "",
                                "day": current_day,
                            }
                    save_world(world)
    except Exception as e:
        logger.warning(f"Prophecy check failed in agent tick for {world_id}: {e}")

    # --- Phase 6: build log entry with consequences ---
    # Build consequence summary from the events we just generated
    consequence_data = None
    if events:
        ce_list = [{"title": e.title, "type": e.type} for e in events]
        morale_map: dict[str, int] = {}
        territory_map: dict[str, str] = {}
        for event in events:
            if hasattr(event, "outcome") and event.outcome:
                for fid, val in (event.outcome.morale_changes or {}).items():
                    morale_map[fid] = morale_map.get(fid, 0) + val
                for rid, fid in (event.outcome.territory_changes or {}).items():
                    territory_map[rid] = fid
        consequence_data = {
            "events": ce_list,
            "morale_changes": morale_map,
            "territory_changes": territory_map,
        }

    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "day": world.current_day if world else 0,
        "reasoning": decision.get("reasoning", ""),
        "decision": decision.get("decision", ""),
        "action": action,
        "intervention_command": decision.get("intervention_command") or None,
        "focus_faction": decision.get("focus_faction") or None,
        "focus_character": decision.get("focus_character") or None,
        "narrative_arc": decision.get("narrative_arc", ""),
        "urgency": decision.get("urgency", "medium"),
        "events_generated": len(events),
        "event_titles": [e.title for e in events],
        "consequences": consequence_data,
    }

    if world_id not in _agent_logs:
        _agent_logs[world_id] = []
    _agent_logs[world_id].append(log_entry)
    _agent_logs[world_id] = _agent_logs[world_id][-100:]

    # Persist log under lock
    async with lock:
        world = load_world(world_id)
        if world:
            world.agent_logs.append(log_entry)
            world.agent_logs = world.agent_logs[-100:]
            save_world(world)

    # Step 5: Notify Telegram with rich narrative data
    try:
        from telegram_bot import notify_linked_chats

        action_label = {"simulate": "Simulated", "intervene": "Intervened", "focus": "Focused"}.get(action, "Acted")
        header = f"World Master (Day {world.current_day}) [{action_label}]"
        if decision.get("reasoning"):
            header += f"\n{decision['reasoning'][:200]}"

        asyncio.create_task(notify_linked_chats(
            world_id,
            message=header,
            events=events,
            prophecy_fulfilled=prophecy_fulfilled_data,
        ))
    except Exception:
        pass

    logger.info(
        f"Agent tick for {world_id}: day={world.current_day}, action={action}, "
        f"events={len(events)}, urgency={decision.get('urgency', 'medium')}"
    )

    return log_entry


async def agent_loop(world_id: str, interval_seconds: int = 120):
    """Background loop that runs agent ticks at a regular interval."""
    interval_seconds = max(30, interval_seconds)  # Defense-in-depth floor
    _running_agents[world_id] = True
    logger.info(
        f"Autonomous agent started for world {world_id} "
        f"(interval: {interval_seconds}s)"
    )

    while _running_agents.get(world_id, False):
        try:
            await agent_tick(world_id)
        except Exception as e:
            logger.error(f"Agent tick error for {world_id}: {e}")

        # Wait for interval, checking for stop signal every second
        for _ in range(interval_seconds):
            if not _running_agents.get(world_id, False):
                break
            await asyncio.sleep(1)

    logger.info(f"Autonomous agent stopped for world {world_id}")


MAX_CONCURRENT_AGENTS = 5

def start_agent(world_id: str, interval: int = 120) -> str:
    """Start the autonomous agent for a world.

    Returns: "started", "already_running", or "max_agents_reached".
    """
    if _running_agents.get(world_id, False):
        return "already_running"
    active_count = sum(1 for v in _running_agents.values() if v)
    if active_count >= MAX_CONCURRENT_AGENTS:
        logger.warning(f"Cannot start agent for {world_id}: {active_count} agents already running (max {MAX_CONCURRENT_AGENTS})")
        return "max_agents_reached"
    asyncio.create_task(agent_loop(world_id, interval))
    return "started"


def stop_agent(world_id: str):
    """Stop the autonomous agent for a world."""
    _running_agents[world_id] = False


def cleanup_agent_state(world_id: str):
    """Remove all in-memory state for a deleted world."""
    _running_agents.pop(world_id, None)
    _agent_logs.pop(world_id, None)
    _agent_plans.pop(world_id, None)


def is_agent_running(world_id: str) -> bool:
    return _running_agents.get(world_id, False)


def get_agent_logs(world_id: str) -> list:
    """Get agent logs -- in-memory first, fall back to persisted world data."""
    in_memory = _agent_logs.get(world_id, [])
    if in_memory:
        return in_memory

    # Fall back to persisted logs from world data
    world = load_world(world_id)
    if world and world.agent_logs:
        return world.agent_logs

    return []
