---
name: genesis-worldbuilder
description: Generate a complete living world from a natural language concept — geography, factions, characters with genetic traits
version: 1.0.0
metadata:
  hermes:
    tags: [worldbuilding, procedural-generation, fiction, creative, genesis]
    related_skills: [genesis-simulator]
    category: creative
---

# Genesis Worldbuilder

Generate complete living worlds from natural language descriptions. Creates geography, factions, and characters with genetic trait systems.

## When to Use

When the user asks to:
- Create a world, universe, or fictional setting
- Generate a fantasy/sci-fi/post-apocalyptic world
- Build a setting for a story, game, or campaign
- "Make me a world about..."

## Prerequisites

- Genesis API running (FastAPI backend at configured URL)
- Nous Research API key configured

## Procedure

### Phase 1: Parse the Concept

Extract from the user's description:
- **Theme** (fantasy, sci-fi, post-apocalyptic, historical, etc.)
- **Core conflict** (resource scarcity, political rivalry, ideological war, etc.)
- **Scale** (village, kingdom, continent, planet, galaxy)
- **Tone** (dark, hopeful, gritty, whimsical)

If the description is vague, ask ONE clarifying question. Don't over-ask — generate and refine.

### Phase 2: Generate World Elements

Use `delegate_task` with batch mode (3 parallel tasks):

**Task 1 — Geography:**
```
goal: "Generate 6 regions for a world with this concept: [SEED]. Output JSON with regions array (id, name, type, climate, resources, neighbors, x, y, description) and connections array."
toolsets: ["web"]
```

**Task 2 — Factions:**
```
goal: "Generate 4 factions for a world with this concept: [SEED] and these regions: [REGION_SUMMARY]. Output JSON array with id, name, ideology, color, territory, resources, alliances, enemies, population, morale, traits, description."
toolsets: ["web"]
```

**Task 3 — Characters:**
```
goal: "Generate 15 characters for a world with this concept: [SEED], these factions: [FACTION_SUMMARY], and these regions: [REGION_SUMMARY]. Each character needs id, name, faction_id, role, age, location, backstory, goals, relationships, and genome (courage/cunning/loyalty/ambition/empathy/resilience as 0-1 values). Output JSON array."
toolsets: ["web"]
```

### Phase 3: Assemble and Deploy

1. Combine geography, factions, and characters into a world JSON
2. POST to Genesis API: `/api/worlds` with the seed
3. Report the live URL to the user
4. Offer to simulate days or explore the world

### Phase 4: Schedule Autonomous Simulation (Optional)

If the user wants the world to evolve on its own, use `schedule_cronjob`:

```
prompt: "Load world [WORLD_ID] from Genesis API at [API_URL]. Call POST /api/worlds/[WORLD_ID]/simulate?days=1 to advance one day. Then GET the latest events and summarize the key developments in 2-3 sentences."
schedule: "every 1h"
deliver: "telegram"
name: "genesis-[WORLD_NAME]-sim"
```

## Example Interaction

**User:** "Create a world where magic is dying and three noble houses fight over the last wellspring"

**Agent:**
1. Parses: fantasy theme, resource conflict (magic wellspring), kingdom scale, dramatic tone
2. Delegates 3 parallel tasks for geography/factions/characters
3. Assembles world, posts to API
4. Returns: "Your world 'The Fading Realm' is live at [URL]. 6 regions, 3 noble houses, 15 characters. Want me to start simulating events?"

## Pitfalls

- Don't generate more than 20 characters — quality drops
- Ensure every region is controlled by exactly one faction
- Genome values must be 0.0-1.0
- Character relationships must reference valid character IDs
- If LLM returns invalid JSON, retry once with a stricter prompt
