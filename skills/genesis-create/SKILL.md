---
name: genesis-create
description: Create a living world from a single sentence — AI generates geography, factions, characters with DNA, and prophecies
version: 1.0.0
metadata:
  hermes:
    tags: [worldbuilding, generation, creative]
    category: simulation
    requires_toolsets: [terminal, web]
---

# Genesis Create — World Generation from Natural Language

## When to Use
When the user wants to create a new living world from a description. One sentence becomes a complete civilization with geography, factions, characters carrying genetic traits, and ancient prophecies.

## Procedure

### Step 1: Generate the World
```bash
curl -X POST http://localhost:8003/api/worlds/generate \
  -H "Content-Type: application/json" \
  -d '{"seed": "Norse mythology where Ragnarok approaches"}'
```

The seed can be anything:
- "cyberpunk megacity with corporate warfare"
- "ancient Rome during the fall of the republic"
- "underwater civilization of sentient coral beings"
- "post-apocalyptic desert where water is currency"

### Step 2: Verify Generation
```bash
curl http://localhost:8003/api/worlds/{world_id}
```

Check that the response includes:
- `geography.regions` — 4-6 named regions with terrain types
- `factions` — 3-5 factions with ideologies, territory, morale
- `characters` — 15-25 characters with genome traits, roles, faction allegiances
- `prophecies` — 4 cryptic prophecies with fulfillment conditions

### Step 3: Start Simulation
Once the world exists, start the autonomous agent:
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/agent/start \
  -d '{"interval": 120}'
```

Or run individual simulation ticks:
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/simulate
```

## What Gets Generated

| Component | Details |
|-----------|---------|
| **Geography** | 4-6 regions with name, terrain, resources, strategic value |
| **Factions** | 3-5 groups with ideology, leader, territory, morale, population |
| **Characters** | 15-25 people with name, role, faction, genome (6 traits), backstory |
| **Prophecies** | 4 cryptic predictions with hidden fulfillment conditions |
| **Relationships** | Initial alliances and enmities between factions |

## Pitfalls
- Generation takes 15-30 seconds (multiple LLM calls for each component)
- Very abstract seeds ("chaos") produce less coherent worlds than specific ones
- The API returns a world_id — save it for all subsequent interactions

## Verification
- Response has `id` field starting with `world_`
- `characters` array has entries with `genome` containing all 6 traits
- `prophecies` array has exactly 4 entries with `fulfilled: false`
