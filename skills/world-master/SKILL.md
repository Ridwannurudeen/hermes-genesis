---
name: world-master
description: Autonomous World Master agent that governs a living fantasy world — observes state, reasons about narrative arcs, and takes actions (simulate, intervene, focus) to create emergent stories
version: 1.0.0
metadata:
  hermes:
    tags: [simulation, worldbuilding, autonomous-agent, narrative]
    category: simulation
    requires_toolsets: [terminal, web]
---

# World Master — Autonomous Living World Agent

## When to Use
When the user wants to run, govern, or interact with a Hermes Genesis living world. This skill implements the full observe→reason→act agent loop for autonomous world simulation.

## Architecture

The World Master follows the hermes-agent pattern:
1. **Observe** — Read world state (factions, characters, events, prophecies)
2. **Reason** — Analyze tensions, power dynamics, narrative arcs, prophecy conditions
3. **Act** — Choose: simulate (organic events), intervene (force a crisis), or focus (steer a storyline)
4. **Reflect** — Review consequences of the last action and adjust strategy

## Available Actions

### 1. Simulate (Organic Events)
Let the world run naturally. Events emerge from character genomes, faction dynamics, and causality chains.
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/simulate
```

### 2. Intervene (Divine Intervention)
Force a specific dramatic event. Use for prophecy fulfillment, turning points, or narrative climaxes.
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/intervene \
  -H "Content-Type: application/json" \
  -d '{"command": "A volcanic eruption destroys the northern fortress"}'
```

### 3. Focus (Steer Storyline)
Run simulation biased toward a specific faction or character arc.
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/simulate \
  -H "Content-Type: application/json" \
  -d '{"focus_faction": "faction_001"}'
```

### 4. Start Autonomous Agent
Start the agent loop — it will tick every N seconds, making its own decisions.
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/agent/start \
  -H "Content-Type: application/json" \
  -d '{"interval": 120}'
```

### 5. Stop Agent
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/agent/stop
```

## Observation Format

The World Master builds its observation from:
- **Factions**: name, territory count, morale, population, allies, enemies
- **Characters**: top 15 by fitness, with role, faction, location, genome traits
- **Recent Events**: last 10 events with day, type, title
- **Prophecies**: fulfilled/unfulfilled status with text
- **Consequences**: feedback from the last action (what events resulted, who died, what changed)

## Decision Format

The World Master returns structured JSON:
```json
{
  "reasoning": "Analysis of current tensions and dynamics",
  "action": "simulate|intervene|focus",
  "decision": "What the World Master chose to do",
  "intervention_command": "Natural language command (if intervene)",
  "focus_faction": "faction_id (if focus)",
  "narrative_arc": "The multi-day story being built",
  "urgency": "low|medium|high"
}
```

## Genome System

Every character carries 6 genetic traits (0.0–1.0):
- **Courage** — wins battles, survives disasters
- **Cunning** — wins intrigue, political maneuvering
- **Loyalty** — prevents betrayal, strengthens alliances
- **Ambition** — drives succession, power grabs
- **Empathy** — cultural shifts, diplomacy
- **Resilience** — survival, recovery from setbacks

Children inherit traits via crossover (50% each parent) + 10% mutation. Low-fitness characters die off — natural selection reshapes the population.

## Prophecy System

Each world has 4 cryptic prophecies with conditions. The World Master:
1. Tracks unfulfilled prophecies in every observation
2. Can nudge events toward prophecy conditions via "focus" or "intervene"
3. Automatically detects when conditions are met
4. Triggers fulfillment events with narrative

## Pitfalls
- Don't intervene too frequently — organic simulation creates better emergent stories
- Check that faction/character IDs exist before focusing on them
- The agent needs at least 30 seconds between ticks (rate limit protection)
- Prophecy fulfillment may take 50+ days of simulation to trigger naturally

## Verification
- `GET /api/worlds/{world_id}` — check world state, day count, event count
- `GET /api/worlds/{world_id}/agent/status` — check if agent is running
- `GET /api/worlds/{world_id}/agent/logs` — review agent reasoning and decisions
