---
name: genesis-chronicle
description: Export a living world's history as a publishable chronicle, TTRPG campaign kit, or GM session prep document
version: 1.0.0
metadata:
  hermes:
    tags: [export, narrative, ttrpg, writing]
    category: simulation
    requires_toolsets: [terminal, web]
---

# Genesis Chronicle — World History Export

## When to Use
When the user wants to export a world's accumulated history as a readable document. Three export formats available: epic chronicle (narrative history), campaign kit (TTRPG module), or session prep (GM planning document).

## Procedure

### Chronicle Export (Epic Narrative)
Generates a literary retelling of the world's history — births, deaths, wars, prophecies.
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/chronicle
```

### Campaign Kit Export (TTRPG Module)
Generates a ready-to-play tabletop RPG module with factions, NPCs, plot hooks, and encounter tables.
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/campaign-kit
```

### Session Prep Export (GM Planning)
Generates a concise GM planning document with current tensions, NPC motivations, and upcoming plot threads.
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/session-prep
```

## Output Format
All exports return markdown text suitable for:
- Direct reading
- Copy-paste into documents
- Publishing as blog posts or PDFs
- Importing into VTT platforms

## Pitfalls
- Export quality scales with simulation depth — run at least 50+ days for rich chronicles
- Chronicle generation calls the LLM, so it takes 10-20 seconds
- Very long histories (500+ events) may be summarized rather than fully narrated

## Verification
- Response contains markdown with headers, sections, and narrative prose
- Chronicle covers major events, character arcs, and prophecy fulfillments
- Campaign kit includes stat blocks, encounter tables, and plot hooks
