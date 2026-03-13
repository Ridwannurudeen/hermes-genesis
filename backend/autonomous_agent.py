import asyncio
import json
import logging
from datetime import datetime
from config import DATA_DIR
from store import load_world, save_world, list_worlds
from simulation import simulate_tick
from llm import chat_completion, extract_json

logger = logging.getLogger(__name__)

# In-memory state for running agents
_running_agents: dict[str, bool] = {}  # world_id -> active
_agent_logs: dict[str, list] = {}  # world_id -> list of log entries

AGENT_SYSTEM = """You are the World Master -- an autonomous AI agent governing a living fantasy world.
You observe the current state and decide what should happen next.

Analyze the world and return ONLY valid JSON:
{
  "reasoning": "2-3 sentences explaining your analysis of the current state and tensions",
  "decision": "1 sentence describing what you've decided should happen",
  "focus_faction": "faction_id you're focusing on (or null)",
  "focus_character": "character_id you're focusing on (or null)",
  "narrative_arc": "Brief description of the story arc you're building toward",
  "urgency": "low|medium|high -- how dramatic should the next events be"
}

Consider:
- Which factions are in tension? Who's growing too powerful?
- Are any characters near death (low fitness)? Any rising stars?
- What prophecies remain unfulfilled? Can you nudge events toward fulfillment?
- What would make the most compelling story right now?
- Don't let the world stagnate -- create drama, tension, consequences."""


def _build_observation(world) -> str:
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

What should happen next in this world? Analyze and decide."""


async def agent_tick(world_id: str):
    """One autonomous agent tick: observe, reason, act."""
    world = load_world(world_id)
    if not world:
        return None

    # Step 1: Observe and Reason
    observation = _build_observation(world)
    try:
        raw = await chat_completion(
            AGENT_SYSTEM, observation, max_tokens=500, temperature=0.9
        )
        decision = extract_json(raw)
    except Exception as e:
        logger.warning(f"Agent reasoning failed for {world_id}: {e}")
        decision = {
            "reasoning": "Could not analyze -- proceeding with standard simulation",
            "decision": "Run normal simulation tick",
            "narrative_arc": "unknown",
            "urgency": "medium",
        }

    # Step 2: Act -- run simulation
    events = simulate_tick(world)
    world = load_world(world_id)  # Reload after tick

    # Step 3: Generate narrative for events (for non-death events)
    from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt

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

    save_world(world)

    # Step 4: Log the decision
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "day": world.current_day,
        "reasoning": decision.get("reasoning", ""),
        "decision": decision.get("decision", ""),
        "narrative_arc": decision.get("narrative_arc", ""),
        "urgency": decision.get("urgency", "medium"),
        "events_generated": len(events),
        "event_titles": [e.title for e in events],
    }

    if world_id not in _agent_logs:
        _agent_logs[world_id] = []
    _agent_logs[world_id].append(log_entry)
    # Keep only last 50 entries
    _agent_logs[world_id] = _agent_logs[world_id][-50:]

    # Step 5: Notify Telegram
    try:
        from telegram_bot import notify_linked_chats

        summary = f"World Master (Day {world.current_day})\n"
        summary += f"Reasoning: {decision.get('reasoning', '')[:200]}\n"
        summary += f"Events: {len(events)}\n"
        for ev in events[:3]:
            summary += f"- {ev.title}\n"
        asyncio.create_task(notify_linked_chats(world_id, summary))
    except Exception:
        pass

    logger.info(
        f"Agent tick for {world_id}: day={world.current_day}, "
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
    return _agent_logs.get(world_id, [])
