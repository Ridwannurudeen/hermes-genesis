import asyncio
import json
import logging
from datetime import datetime, timezone
from config import DATA_DIR
from store import load_world, save_world, list_worlds
from simulation import simulate_tick
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


async def _execute_intervention(world, decision: dict) -> tuple:
    """Execute an agent intervention -- create a specific event via the LLM.
    Returns (events, world) tuple. World may be reloaded on failure."""
    from prompts.intervention import SYSTEM as INTERVENTION_SYSTEM, intervention_prompt
    from models.event import Event

    command = decision.get("intervention_command", decision.get("decision", "Something dramatic happens"))

    prompt = intervention_prompt(
        command,
        world.name,
        world.seed,
        world.current_day,
        [r.model_dump() for r in world.geography.regions],
        [f.model_dump() for f in world.factions],
        [c.model_dump() for c in world.characters],
    )

    raw = await chat_completion(INTERVENTION_SYSTEM, prompt, max_tokens=1000)
    data = extract_json(raw)

    # Advance day FIRST so event is recorded on the new day
    next_day = world.current_day + 1
    world.current_day = next_day

    # Create the intervention event
    event = Event(
        id=f"evt_{next_day:03d}_agent_{len(world.events)}",
        day=next_day,
        type="divine_intervention",
        title=data.get("title", "The World Master Acts"),
        description=data.get("description", ""),
        narrative=data.get("narrative", ""),
        actors=data.get("actors", []),
        factions_involved=data.get("factions_involved", []),
        regions_affected=data.get("regions_affected", []),
        agent_triggered=True,
    )

    # Apply effects (same logic as routes/worlds.py divine_intervention endpoint)
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

    # Snapshot faction state on the new day
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
    """Bias world state slightly to steer simulation toward focused faction/character."""
    focus_fid = decision.get("focus_faction")
    focus_cid = decision.get("focus_character")

    if focus_fid:
        for f in world.factions:
            if f.id == focus_fid:
                # Pressure creates drama -- lower morale to generate tension events
                if decision.get("urgency") == "high":
                    f.morale = max(0, f.morale - 15)
                elif decision.get("urgency") == "medium":
                    f.morale = max(0, f.morale - 8)
                break

    if focus_cid:
        for c in world.characters:
            if c.id == focus_cid and c.alive:
                # Boost fitness to make them more likely to appear in events
                c.fitness = min(1.0, c.fitness + 0.15)
                break

    save_world(world)


async def agent_tick(world_id: str):
    """One autonomous agent tick: observe, reason, act based on LLM decision."""
    world = load_world(world_id)
    if not world:
        return None

    # Step 1: Observe and Reason (pass world_id for consequence feedback)
    observation = _build_observation(world, world_id)

    # Include the agent's previous plan if it exists
    if world_id in _agent_plans:
        observation += f"\n\nYOUR PREVIOUS PLAN: {_agent_plans[world_id]}"
        observation += "\nContinue or revise this plan based on what has happened."

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

    # Validate action value
    if action not in ("simulate", "intervene", "focus"):
        logger.warning(f"Agent returned invalid action '{action}', falling back to simulate")
        action = "simulate"

    # Persist the narrative arc as the agent's ongoing plan
    arc = decision.get("narrative_arc", "")
    if arc:
        _agent_plans[world_id] = arc

    # Step 2: Act based on decision
    events = []

    if action == "intervene" and decision.get("intervention_command"):
        try:
            events, world = await _execute_intervention(world, decision)
        except Exception as e:
            logger.warning(f"Agent intervention failed, falling back to simulate: {e}")
            action = "simulate"  # Update action for logging accuracy
            world = load_world(world_id)
            events = simulate_tick(world)
            world = load_world(world_id)

    elif action == "focus":
        _apply_focus_bias(world, decision)
        world = load_world(world_id)  # Reload after bias save
        events = simulate_tick(world)
        world = load_world(world_id)

    else:
        # Default: normal simulation
        events = simulate_tick(world)
        world = load_world(world_id)

    # Step 3: Generate narrative for events (for non-death events without narratives)
    from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt

    world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"
    for event in events:
        if event.type != "death" and not event.narrative:
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

    save_world(world)

    # Step 3b: Check prophecy fulfillment
    prophecy_fulfilled_data = None
    try:
        from prophecy_checker import check_and_fulfill_prophecies

        prophecy_events = await check_and_fulfill_prophecies(
            world, events, world.current_day
        )
        if prophecy_events:
            world.events.extend(prophecy_events)
            events.extend(prophecy_events)
            save_world(world)
            # Extract prophecy data for Telegram notification
            for p in getattr(world, "prophecies", []):
                if p.fulfilled and p.fulfilled_day == world.current_day:
                    prophecy_fulfilled_data = {
                        "text": p.text,
                        "explanation": prophecy_events[0].description if prophecy_events else "",
                        "day": world.current_day,
                    }
                    break
    except Exception as e:
        logger.warning(f"Prophecy check failed in agent tick for {world_id}: {e}")

    # Step 4: Log the decision with action taken visible
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "day": world.current_day,
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
    }

    if world_id not in _agent_logs:
        _agent_logs[world_id] = []
    _agent_logs[world_id].append(log_entry)
    # Keep only last 50 entries in-memory
    _agent_logs[world_id] = _agent_logs[world_id][-50:]

    # Persist log to world data (capped at 100 entries)
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


def start_agent(world_id: str, interval: int = 120):
    """Start the autonomous agent for a world. Returns True if started."""
    if _running_agents.get(world_id, False):
        return False  # Already running
    asyncio.create_task(agent_loop(world_id, interval))
    return True


def stop_agent(world_id: str):
    """Stop the autonomous agent for a world."""
    _running_agents[world_id] = False


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
