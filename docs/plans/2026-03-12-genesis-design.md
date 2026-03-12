# HERMES GENESIS — Design Document

**Date:** 2026-03-12
**Deadline:** 2026-03-16 (NousResearch Hermes Agent Hackathon)
**Tagline:** "Describe a world. Watch it live."

---

## 1. Product Overview

HERMES GENESIS is an autonomous living world engine built on hermes-agent. Users describe a world concept in natural language. Genesis generates the full world (geography, factions, characters with genetic traits), deploys it as an interactive web explorer, then autonomously simulates events and delivers narrative updates via Telegram — the world keeps living whether you're watching or not.

### Core Loop

```
Seed → Generate (parallel subagents) → Deploy (live web explorer) → Simulate (cron) → Evolve (genome) → Narrate (Telegram)
```

### Judging Criteria Alignment

| Criteria | Score | How |
|----------|-------|-----|
| Creativity | 10/10 | Procedural living worlds with character evolution — nobody has this |
| Usefulness | 9/10 | Writers, game devs, D&D players, educators, screenwriters |
| Presentation | 10/10 | Interactive map + live simulation + Telegram narrative mid-demo |

---

## 2. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    HERMES-AGENT                          │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Geography    │  │ Faction      │  │ Character    │  │
│  │ Subagent     │  │ Subagent     │  │ Subagent     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └─────────────────┼─────────────────┘           │
│                           ▼                             │
│              ┌────────────────────────┐                 │
│              │   World Assembler      │                 │
│              │   (merges + validates) │                 │
│              └───────────┬────────────┘                 │
│                          │                              │
│  ┌───────────────────────┼────────────────────────┐     │
│  │                       ▼                        │     │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────────┐  │     │
│  │  │ Cron    │→ │ Simulate │→ │ Narrate +    │  │     │
│  │  │ Ticker  │  │ Engine   │  │ Telegram     │  │     │
│  │  └─────────┘  └──────────┘  └──────────────┘  │     │
│  │              Simulation Loop                   │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────┬───────────────────────────────┘
                          │ JSON world data
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  GENESIS WEB EXPLORER                    │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ FastAPI   │  │ React    │  │ Interactive Map      │  │
│  │ Backend   │← │ Frontend │← │ + Faction Panels     │  │
│  │ (world    │  │ (SPA)    │  │ + Character Profiles │  │
│  │  data API)│  │          │  │ + Event Timeline     │  │
│  └──────────┘  └──────────┘  │ + Evolution Tree     │  │
│                               └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Hermes-Agent Feature Usage

| Feature | Usage |
|---------|-------|
| `delegate_task` (batch mode) | 3 parallel subagents for world generation |
| `execute_code` | Simulation engine runs as sandboxed Python |
| `cronjob` | Scheduled simulation ticks (configurable interval) |
| `send_message` | Narrative updates to Telegram |
| `memory` | World state summary for cross-session awareness |
| `skill_manage` | Genesis skills created/improved over time |
| `terminal` | Deploy web explorer, manage Docker containers |
| `web_search` | Optional: research real-world inspiration |

---

## 3. World Data Model

### World

```json
{
  "id": "world_<uuid>",
  "name": "The Shattered Expanse",
  "seed": "post-apocalyptic wasteland, three rival settlements, last clean water",
  "theme": "post-apocalyptic",
  "created_at": "2026-03-12T10:00:00Z",
  "current_day": 47,
  "geography": { ... },
  "factions": [ ... ],
  "characters": [ ... ],
  "events": [ ... ],
  "world_rules": { ... }
}
```

### Geography

```json
{
  "regions": [
    {
      "id": "region_01",
      "name": "The Scorched Flats",
      "type": "wasteland",
      "climate": "arid",
      "resources": ["scrap_metal", "solar_energy"],
      "controlled_by": "faction_01",
      "neighbors": ["region_02", "region_03"],
      "points_of_interest": [
        { "name": "Old Reactor", "type": "ruin", "significance": "contains pre-war tech" }
      ],
      "x": 0.3, "y": 0.5
    }
  ],
  "connections": [
    { "from": "region_01", "to": "region_02", "type": "road", "control": "contested" }
  ]
}
```

### Faction

```json
{
  "id": "faction_01",
  "name": "The Iron Collective",
  "ideology": "authoritarian industrialism",
  "color": "#c0392b",
  "leader_id": "char_03",
  "territory": ["region_01", "region_04"],
  "resources": { "water": 30, "food": 45, "tech": 80, "military": 70 },
  "alliances": ["faction_03"],
  "enemies": ["faction_02"],
  "population": 2400,
  "morale": 72,
  "traits": ["disciplined", "expansionist", "technophile"]
}
```

### Character (with Genome)

```json
{
  "id": "char_03",
  "name": "Commander Reya Voss",
  "faction_id": "faction_01",
  "role": "leader",
  "age": 34,
  "alive": true,
  "location": "region_01",
  "backstory": "Rose through ranks after the Reactor Siege...",
  "goals": ["secure_water_source", "eliminate_faction_02_scouts"],
  "relationships": {
    "char_05": { "type": "rival", "intensity": 0.8 },
    "char_07": { "type": "mentor", "intensity": 0.6 }
  },
  "genome": {
    "courage": 0.82,
    "cunning": 0.91,
    "loyalty": 0.45,
    "ambition": 0.88,
    "empathy": 0.30,
    "resilience": 0.76
  },
  "lineage": {
    "parent_ids": [],
    "generation": 0,
    "mutations": []
  },
  "fitness": 0.0
}
```

### Event

```json
{
  "id": "evt_047_01",
  "day": 47,
  "type": "military_conflict",
  "title": "The Northern Pass Falls",
  "description": "Commander Reya's forces breached the mountain pass...",
  "actors": ["char_03", "char_05"],
  "factions_involved": ["faction_01", "faction_02"],
  "regions_affected": ["region_02"],
  "outcome": {
    "territory_changes": { "region_02": "faction_01" },
    "casualties": { "faction_01": 120, "faction_02": 340 },
    "morale_changes": { "faction_01": +8, "faction_02": -15 },
    "character_effects": [
      { "char_id": "char_03", "effect": "fitness_boost", "value": 0.15 },
      { "char_id": "char_05", "effect": "captured", "value": true }
    ]
  },
  "narrative": "The pass held for six days before Reya's sappers found the drainage tunnel..."
}
```

---

## 4. Genome System

### Trait Vector

Every character has 6 core traits (0.0 to 1.0):

| Trait | Affects |
|-------|---------|
| `courage` | Military decisions, standing ground vs retreating |
| `cunning` | Subterfuge, diplomacy, deception success |
| `loyalty` | Defection probability, alliance stability |
| `ambition` | Power grabs, risk-taking, leadership challenges |
| `empathy` | Civilian treatment, mercy decisions, morale effects |
| `resilience` | Survival under pressure, recovery from setbacks |

### Crossover

When two characters mentor, ally closely, or have offspring:

```python
def crossover(parent_a, parent_b, mutation_rate=0.1):
    child_genome = {}
    for trait in TRAITS:
        # Random crossover point
        if random.random() < 0.5:
            child_genome[trait] = parent_a.genome[trait]
        else:
            child_genome[trait] = parent_b.genome[trait]
        # Mutation
        if random.random() < mutation_rate:
            child_genome[trait] = clamp(child_genome[trait] + random.gauss(0, 0.1), 0, 1)
    return child_genome
```

### Fitness Function

After each simulation tick, character fitness is updated based on outcomes:

```python
fitness = (
    0.3 * survival_score +        # alive, healthy, not captured
    0.25 * influence_score +      # faction standing, followers
    0.25 * goal_completion +      # progress toward personal goals
    0.2 * relationship_health     # alliance strength, trust from others
)
```

### Natural Selection

Characters with low fitness face higher death/removal probability. High-fitness characters get more "offspring" events (mentoring, children, successors). Over 10+ simulation ticks, the population's trait distribution shifts based on the world's pressures — war-torn worlds select for courage/resilience, political worlds select for cunning/ambition.

---

## 5. Simulation Engine

### Tick Logic (runs each cron interval)

```
1. ASSESS — Evaluate world state (resource levels, faction tensions, character goals)
2. DECIDE — Each character picks an action based on genome + goals + situation
3. RESOLVE — Conflicts resolved (trait-weighted probability), events generated
4. EVOLVE — Fitness updated, low-fitness characters face consequences, crossover events
5. NARRATE — Generate prose for significant events
6. PERSIST — Save updated world state
7. DELIVER — Send narrative to Telegram
```

### Event Types

| Type | Trigger | Genome Influence |
|------|---------|-----------------|
| `military_conflict` | Territory dispute, resource scarcity | courage, resilience |
| `political_intrigue` | Ambition > loyalty, rival factions | cunning, ambition |
| `betrayal` | Low loyalty + high ambition + opportunity | loyalty (inverse), cunning |
| `alliance` | Shared enemy, high empathy leaders | empathy, cunning |
| `discovery` | Exploration goals, resource search | courage, resilience |
| `succession` | Leader death/capture, power vacuum | ambition, cunning, loyalty |
| `cultural_shift` | Population pressure, morale extremes | empathy, resilience |
| `natural_disaster` | Random (theme-appropriate) | resilience |

### Conflict Resolution

```python
def resolve_conflict(attacker, defender):
    attack_score = (
        attacker.genome['courage'] * 0.3 +
        attacker.genome['cunning'] * 0.3 +
        attacker.faction.resources['military'] / 100 * 0.4
    ) + random.gauss(0, 0.1)

    defend_score = (
        defender.genome['resilience'] * 0.3 +
        defender.genome['courage'] * 0.2 +
        defender.faction.resources['military'] / 100 * 0.4 +
        0.1  # defender advantage
    ) + random.gauss(0, 0.1)

    return 'attacker' if attack_score > defend_score else 'defender'
```

---

## 6. Web Explorer (React Frontend)

### Pages / Views

| View | Description |
|------|-------------|
| **World Map** | Interactive SVG map with regions as styled nodes, connections as paths, faction colors, resource icons. Click region → detail panel. |
| **Faction Dashboard** | All factions with resource bars, territory count, population, morale, leader portrait, alliance web. |
| **Character Profiles** | Character card with genome radar chart, backstory, goals, relationships graph, lineage tree. |
| **Event Timeline** | Chronological event feed with day markers, type icons, expandable narratives. Filter by faction/character. |
| **Evolution View** | Trait distribution heatmap across generations. Population genome averages over time. Family trees with trait inheritance arrows. |
| **World Overview** | Stats dashboard — population, day count, active conflicts, dominant faction, most-fit character. |

### Map Design

Stylized 2D SVG — NOT 3D. Regions as organic shapes (like a hand-drawn map) with:
- Faction colors (fill with opacity)
- Resource icons (small SVG symbols)
- Connection lines (roads = solid, contested = dashed)
- Animated pulse on active conflict regions
- Zoom/pan via SVG viewBox manipulation
- Click interactions → side panel with details

### Tech Stack

- React 18 + TypeScript
- Vite for bundling
- Tailwind CSS for styling
- D3.js for map rendering + force layout for relationship graphs
- Recharts for genome radar charts and evolution timeline
- Framer Motion for animations
- FastAPI backend serving world JSON

---

## 7. API Endpoints

```
GET  /api/worlds                    — List all worlds
POST /api/worlds                    — Create new world (accepts seed text)
GET  /api/worlds/:id                — Full world state
GET  /api/worlds/:id/map            — Geography + factions (map data)
GET  /api/worlds/:id/factions       — All factions with details
GET  /api/worlds/:id/characters     — All characters with genomes
GET  /api/worlds/:id/characters/:id — Single character + lineage
GET  /api/worlds/:id/events         — Event timeline (paginated)
GET  /api/worlds/:id/events?day=N   — Events for a specific day
POST /api/worlds/:id/simulate       — Manually trigger simulation tick
GET  /api/worlds/:id/evolution      — Genome statistics over generations
GET  /api/worlds/:id/narrative      — Latest narrative prose
WS   /ws/worlds/:id                 — Real-time updates during generation/simulation
```

---

## 8. Hermes-Agent Skill

### `genesis-worldbuilder` Skill (SKILL.md)

The primary skill that hermes-agent loads. It guides the agent through:

1. Parse the user's seed concept
2. Use `delegate_task` with 3 parallel tasks:
   - Geography generation (regions, terrain, resources, connections)
   - Faction generation (3-7 factions, ideologies, resource allocation)
   - Character generation (10-20 characters with genomes, goals, relationships)
3. Assemble world data (cross-reference factions→territories, characters→factions)
4. Write world JSON to data directory
5. Deploy/update the web explorer
6. Schedule cron job for simulation ticks
7. Send initial world summary to Telegram

### `genesis-simulator` Skill (SKILL.md)

Loaded by cron jobs. Runs one simulation tick:

1. Load current world state
2. Run simulation logic (assess → decide → resolve → evolve)
3. Generate narrative for significant events
4. Save updated world state
5. Deliver narrative via Telegram

---

## 9. Deployment

### Stack

- **VPS**: 75.119.153.252 (Contabo, already set up with nginx + Docker)
- **Backend**: FastAPI in Docker container (port 8003)
- **Frontend**: React SPA built by Vite, served by nginx
- **Data**: JSON files in `/opt/genesis/data/worlds/`
- **Domain**: genesis.hermes-ouroboros.online (subdomain of existing domain) OR separate domain
- **SSL**: certbot (already configured on VPS)

### Docker Compose

```yaml
services:
  genesis-api:
    build: .
    ports:
      - "8003:8003"
    volumes:
      - /opt/genesis/data:/app/data
    environment:
      - NOUS_API_KEY=${NOUS_API_KEY}
```

### nginx

```
server {
    server_name genesis.hermes-ouroboros.online;

    location / {
        root /opt/genesis/web/dist;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8003;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 10. Timeline (4 days)

| Day | Focus | Deliverables |
|-----|-------|-------------|
| **Day 1** (Mar 12-13) | Core engine | World data model, generation engine (LLM prompts for geography/factions/characters), genome system, world store, FastAPI with all endpoints |
| **Day 2** (Mar 13-14) | Frontend | React app: interactive SVG map, faction dashboard, character profiles with genome radar, event timeline, evolution view |
| **Day 3** (Mar 14-15) | Simulation + Integration | Simulation engine, cron integration, Telegram narrative delivery, hermes-agent skills (worldbuilder + simulator), WebSocket for real-time updates |
| **Day 4** (Mar 15-16) | Deploy + Demo | VPS deployment, polish UI, record demo video, write tweet thread, submit |

### Cut list (if behind schedule)

1. WebSocket real-time updates → use polling instead
2. Evolution tree visualization → show genome stats as simple bar charts
3. Cron simulation → manual "advance day" button only
4. Telegram delivery → web-only
5. Hermes-agent skill self-improvement → skip

---

## 11. Demo Script (3 minutes)

1. **[0:00-0:30]** "This is Hermes Genesis." Type seed: "dying fantasy kingdom where magic is fading and three houses fight over the last magical wellspring"
2. **[0:30-1:00]** Watch agents generate in parallel — geography, factions, characters appearing. Show the live web explorer URL.
3. **[1:00-1:45]** Explore the map — click regions, show faction dashboards, open a character profile, highlight genome radar chart. "Every character has DNA that determines how they behave."
4. **[1:45-2:15]** Trigger simulation — advance 5 days rapidly. Watch events appear in the timeline. A betrayal happens because a character's loyalty gene is low.
5. **[2:15-2:45]** Show evolution — "After 10 days of war, the population's courage score has risen 23%. The cowards died. Natural selection in a fictional world."
6. **[2:45-3:00]** Phone buzzes — show Telegram message: narrative update. "The world lives whether you're watching or not."
