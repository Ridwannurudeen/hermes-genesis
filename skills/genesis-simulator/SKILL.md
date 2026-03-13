---
name: genesis-simulator
description: Advance a Genesis world by simulating days — events, conflicts, evolution, and narrative updates
version: 1.0.0
metadata:
  hermes:
    tags: [simulation, worldbuilding, narrative, evolution, genesis]
    related_skills: [genesis-worldbuilder, genesis-autonomous]
    category: creative
---

# Genesis Simulator

Advance a Genesis world through time. Runs simulation ticks that generate events, resolve conflicts, evolve character genomes, and produce narrative updates.

## When to Use

When the user asks to:
- Advance a world by days/weeks/months
- "What happens next in my world?"
- See how factions/characters evolve
- Get a narrative update from their world
- Run the world forward

## Prerequisites

- A Genesis world must already exist (created via genesis-worldbuilder or the API)
- Genesis API running

## Procedure

### Step 1: Identify the World

If the user has only one world, use it. If multiple, ask which one or use the most recent.

### Step 2: Simulate

Call the Genesis API:
- For 1-5 days with narrative: `POST /api/worlds/{id}/simulate?days=N`
- For bulk advancement (10+ days): `POST /api/worlds/{id}/simulate/quick?days=N`

### Step 3: Narrate Results

Summarize the key events that occurred:
- Major conflicts and their outcomes
- Territory changes
- Character deaths, betrayals, alliances
- New characters born through genome crossover
- Faction power shifts

Format as a compelling narrative report, not a data dump.

### Step 4: Highlight Evolution

If multiple generations exist, note:
- Which traits are being selected for/against
- Population changes
- How the world's "personality" is shifting

## Example Output

**After simulating 5 days:**

> **Days 12-16 in The Fading Realm:**
>
> The Iron Collective's gambit at the Northern Pass succeeded on Day 12 — Commander Reya's courage genome (0.92) proved decisive against Duke Aldric's cunning-heavy forces. But victory came at a cost: 340 Collective soldiers fell.
>
> Day 14 brought betrayal. Spy Shadow (loyalty: 0.30, ambition: 0.85) defected to the Free Houses, taking intelligence about Collective troop positions.
>
> By Day 16, natural selection is visible: the population's average courage has risen 12% as low-courage characters fell in combat. A new generation is emerging — Successor of Reya (generation 1) shows an unusual combination of her mother's courage (0.88) and her mentor's cunning (0.79).

## Autonomous Agent Mode

The system includes an **Autonomous World Agent** — a background AI loop that runs worlds independently. Instead of manually simulating each day, the agent:

1. **Observes** the world state (tensions, weak factions, narrative arcs)
2. **Reasons** about what would be narratively interesting (logged for transparency)
3. **Decides** whether to let the simulation run naturally (~70%) or intervene with dramatic events (~30%)
4. **Maintains memory** of narrative threads across cycles
5. **Logs reasoning** so users can see "the agent's mind" at work

### Autonomous Agent API

- `POST /api/worlds/{id}/agent/start?interval=120` — Start the agent loop (configurable interval in seconds)
- `POST /api/worlds/{id}/agent/stop` — Stop the agent loop
- `GET /api/worlds/{id}/agent/status` — Check if agent is running
- `GET /api/worlds/{id}/agent/logs` — Get the agent's reasoning log (analysis, decisions, narrative arcs)

When the user wants to "let the world run on its own" or "see what the world does by itself", start the autonomous agent. See also the `genesis-autonomous` skill for full agent documentation.

## Pitfalls

- Don't simulate more than 30 days with narrative (LLM calls are slow)
- Use quick simulation for bulk advancement, then narrate key days
- Always reload world data after simulation (state changes)
- The autonomous agent runs every 2 minutes — don't also manually simulate while it's active
