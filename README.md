# HERMES GENESIS

**Describe a world. Watch it live. Watch it die.**

An autonomous living world engine powered by **Hermes-4-70B** and the **Hermes Agent** framework. Type one sentence — the AI builds a complete civilization with regions, factions, characters carrying DNA, and ancient prophecies. Then the world runs itself. No scripting. No prompting. The world just... lives.

**Prep a D&D campaign in 60 seconds.** Generate a novel's worth of consistent lore. Teach geopolitics through live simulation. Download everything as Markdown — drop it into Obsidian, Notion, or Google Docs and start using it immediately.

<p align="center">
  <img src="docs/screenshots/cinematic-mode.png" alt="Cinematic Mode — fullscreen immersive replay with AI-generated scenes" width="100%">
  <br>
  <em>Cinematic Mode — fullscreen AI-generated scenes with procedural ambient sound and voice narration</em>
</p>

> **[Try the Live Demo](https://hermesgenesis.world)** | **[Watch the Demo Video](#demo-video)**

---

## At a Glance

- Type one sentence &rarr; AI builds a living world with geography, factions, characters, prophecies
- Theater Mode &mdash; events play out on a dramatic stage with AI-generated scene images
- Cinematic Mode &mdash; fullscreen immersive experience with ambient sound and voice narration
- Genetic evolution &mdash; characters pass DNA to children, populations shift over generations
- Autonomous World Master &mdash; an AI agent observes, reasons, intervenes, and chases prophecies on its own
- **Download World** &mdash; export everything as structured Markdown for Obsidian, Notion, wikis, or TTRPG prep
- **Campaign Kit / Session Prep** &mdash; AI-generated encounter tables, plot hooks, and GM session plans
- Light/Dark mode &mdash; warm parchment light theme, dark leather dark theme, persists via localStorage
- Hermes Agent Skills &mdash; 5 custom skills + MCP bridge for hermes-agent integration

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/theater-mode.png" alt="Theater Mode">
      <br>
      <b>Theater Mode</b> — Dramatic stage with character sprites, AI scene images, faction positioning
    </td>
    <td width="50%">
      <img src="docs/screenshots/map-view.png" alt="World Map">
      <br>
      <b>World Map</b> — SVG regions, faction territories, prophecy tracking
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/network-graph.png" alt="Network Graph">
      <br>
      <b>Relationship Graph</b> — D3 force-directed network across 146 characters
    </td>
    <td width="50%">
      <img src="docs/screenshots/chronicle-view.png" alt="Chronicle">
      <br>
      <b>Chronicle</b> — 941 events across 322 days of autonomous history
    </td>
  </tr>
</table>

---

## What Makes This Different

| AI Dungeon / NovelAI | ChatGPT D&D Assistants | Dwarf Fortress | **Hermes Genesis** |
|---|---|---|---|
| Generates text on demand | Helps DMs generate content | Procedural world generation | **Autonomous simulation that lives without prompts** |
| No persistent world state | No memory between sessions | No AI-driven narrative | **Characters remember, factions evolve, events chain** |
| Requires constant prompting | Reactive only | Rule-based | **AI World Master acts on its own agenda** |
| No genetic evolution | No evolution | Trait-based | **6-trait DNA with crossover, mutation, natural selection** |
| No exportable output | Copy-paste fragments | ASCII logs | **Full Markdown export — Campaign Kit, Session Prep, Chronicle, World Download** |

---

## Why Hermes-4-70B?

This project exists because of capabilities unique to Hermes:

1. **Uncensored Creative Reasoning** — The World Master makes brutal decisions: kill characters, trigger disasters, betray alliances. Hermes-4-70B maintains narrative logic without safety refusals that would break immersion.

2. **Multi-Persona System Adherence** — Hundreds of characters with distinct personalities shaped by their genome (courage, cunning, loyalty, ambition, empathy, resilience). Hermes maintains character consistency across all interactions — chat, council debates, and event narration.

3. **Structured Reasoning Over Complex State** — The World Master observes hundreds of events, reasons about causality chains, faction power dynamics, and character fitness scores, then makes strategic interventions. Hermes excels at reasoning over structured JSON world state where other models hallucinate or lose context.

4. **Long-Context Planning** — Prophecy fulfillment requires tracking conditions across hundreds of simulated days. The World Master autonomously identifies when world state satisfies prophecy conditions and triggers fulfillment events — true long-term planning without human guidance.

5. **Reliable JSON Generation** — Every LLM call returns structured JSON (events, characters, factions, interventions). Hermes-4-70B produces valid structured output consistently, which is critical for a simulation engine that parses every response programmatically.

---

## Hermes Agent Integration

Hermes Genesis ships with **5 custom hermes-agent skills**, an **MCP bridge server** (11 tools), and a **one-command setup script**. [Hermes Agent v0.2.0](https://github.com/NousResearch/hermes-agent) is **installed and running on our production VPS**, orchestrating worlds through its native tool system.

### Hermes-4-70B Powers Everything — Orchestration AND Simulation

The agent demo ([`hermes-agent-demo.py`](hermes-agent-demo.py)) uses **Hermes-native tool calling** (`<tool_call>` format) so Hermes-4-70B handles ALL layers — reasoning about which tools to call, generating simulation events, and summarizing results:

```
$ python3 hermes-agent-demo.py "Simulate one tick for world_530e99fbdb22"

============================================================
  Hermes Agent — powered by Hermes-4-70B
============================================================

[1/3] Reasoning with Hermes-4-70B...
[2/3] Calling genesis_simulate({"world_id": "world_530e99fbdb22"})...
[3/3] Summarizing with Hermes-4-70B...

In the world of Crossroads of Hermes, day 324 unfolded:

1. Betrayal at the Crossroads: Cyrus Sand betrayed Toea Ember,
   luring him into a trap. Toea's fitness diminished significantly.

2. Cultural Shift: Cyna Sand outmaneuvered Cyrus Sand at the Grand
   Bazaar, forever altering the balance of power among mortals.

3. Military Conflict: Seraion Silk's forces outmatched Yelena of
   Toius Ember at the sacred crossroads.

4. Death: Toea Ember fell. Though ultimately betrayed by Cyrus Sand,
   Toea's legacy endures as one of steadfast devotion.

============================================================
  All layers powered by Hermes-4-70B
============================================================
```

hermes-agent v0.2.0 also connects via MCP bridge, discovering all 11 Genesis tools automatically:

```
$ hermes chat -q "Use genesis MCP tools to list all worlds"

⚡ mcp_genesis_genesis_list_worlds   0.2s

1. Crossroads of Hermes — Day 323
2. Silent Sky Voyager — Day 146
3. Wellspring Kingdom — Day 335
...13 worlds total
```

### Setup ([`setup-hermes-agent.sh`](setup-hermes-agent.sh))

```bash
./setup-hermes-agent.sh              # local backend
./setup-hermes-agent.sh https://hermesgenesis.world  # remote VPS
```

This installs hermes-agent, the MCP bridge, and 5 custom skills in one command.

### Custom Skills ([`skills/`](skills/))

| Skill | What It Does |
|---|---|
| [`world-master`](skills/world-master/SKILL.md) | Full observe→reason→act agent loop — governs a living world autonomously |
| [`genesis-create`](skills/genesis-create/SKILL.md) | Creates a world from a seed sentence — geography, factions, characters, prophecies |
| [`genesis-chat`](skills/genesis-chat/SKILL.md) | In-character conversations shaped by genome, faction, and history |
| [`genesis-chronicle`](skills/genesis-chronicle/SKILL.md) | Exports world history as publishable narratives or TTRPG campaign kits |
| [`mcp-server`](skills/mcp-server/SKILL.md) | MCP configuration guide for connecting hermes-agent to the Genesis API |

### MCP Bridge ([`mcp-bridge/`](mcp-bridge/))

11 tools exposed via Model Context Protocol — hermes-agent auto-discovers them:

```
genesis_create_world    genesis_simulate      genesis_intervene
genesis_get_world       genesis_list_worlds   genesis_chat
genesis_council         genesis_chronicle     genesis_agent_start
genesis_agent_stop      genesis_agent_status
```

### Architecture: How It Fits Together

```
  hermes-agent v0.2.0 (installed on VPS)
         |
    MCP Protocol (stdio)
         |
  +----- v --------+
  | MCP Bridge     |  mcp-bridge/server.mjs
  | (11 tools)     |  genesis_create_world, genesis_simulate, ...
  +----- | --------+
         |
    REST API (HTTP)
         |
  +----- v ---------+
  | FastAPI Backend  |  29 endpoints, autonomous agent, simulation
  +------------------+
         |
    Hermes-4-70B (NousResearch API)
```

The World Master agent ([`autonomous_agent.py`](backend/autonomous_agent.py)) implements the same observe→reason→act pattern as hermes-agent's core loop — domain-specialized for world simulation with genetic evolution, prophecy tracking, and narrative arc planning.

---

## Proof of Scale — Live API Stats

These numbers come from the **[live production API](https://hermesgenesis.world)**, not a demo:

```
$ curl -s https://hermesgenesis.world/api/worlds/world_530e99fbdb22 | jq '{...}'

World: Crossroads of Hermes
Day: 323
Events: 941
Characters: 146 alive, 50 dead (196 total)
Factions: 4
Regions: 6
Prophecies: 4/4 fulfilled
Agent logs: 14

Event breakdown:
  birth: 181          military_conflict: 168
  political_intrigue: 124   alliance: 91
  succession: 84      cultural_shift: 81
  discovery: 73        betrayal: 52
  death: 43            natural_disaster: 31
  divine_intervention: 9    prophecy_fulfilled: 4
```

13 worlds running on the VPS. The largest (Wellspring Kingdom) has reached **Day 335**. All events, characters, and faction dynamics are generated autonomously by Hermes-4-70B — no human scripting.

---

## Demo Video

<!-- Replace with your actual video link -->
<!-- [![Demo Video](https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg)](https://youtu.be/YOUR_VIDEO_ID) -->

*Video coming soon — world generation, map exploration, simulation, cinematic mode, character chat, and chronicle export in 3 minutes.*

---

## How It Works

1. **You describe it** — "Norse mythology where Ragnarok approaches" or "cyberpunk megacity with corporate warfare"
2. **It builds itself** — geography, factions with ideologies, characters with genetic traits, and 4 cryptic prophecies
3. **It comes alive** — every day: battles, political intrigue, betrayals, alliances, discoveries, births, deaths
4. **Events cause events** — a betrayal triggers a war, which causes a succession crisis, which leads to an alliance
5. **An AI agent governs** — the World Master watches, reasons about narrative arcs, and intervenes when the story needs it
6. **Characters evolve** — offspring inherit traits via crossover + mutation. Over generations, natural selection reshapes the population
7. **You use it** — download the world as Markdown for your wiki, generate a Campaign Kit for tonight's D&D session, or export a Chronicle as a narrative draft for your novel

---

## Features

| Category | What You Get |
|---|---|
| **Core Simulation** | World generation from natural language, genome-based character evolution, 13 event types, causality chains, prophecy tracking + fulfillment |
| **Autonomous Agent** | World Master AI with observe-reason-act loop, narrative arc planning, autonomous intervention, prophecy chasing ([source](backend/autonomous_agent.py)) |
| **Hermes Agent Skills** | 5 custom skills for hermes-agent framework + MCP bridge with 11 tools ([skills](skills/), [mcp-bridge](mcp-bridge/)) |
| **Theater Mode** | Dramatic stage with curtains, spotlights, character sprites, faction-aware positioning, speech bubbles, AI scene images, auto-play scrubber |
| **Cinematic Mode** | Fullscreen world map overlay, live auto-simulation, history replay/documentary mode, event title cards with Ken Burns zoom |
| **Audio** | Procedural ambient sound via Web Audio API — 13 mood profiles with oscillators, noise layers, LFO tremolo, crossfade transitions ([source](frontend/src/hooks/useAmbientSound.ts)); voice narration via Web Speech API |
| **Interactive** | SVG world map with event markers, God Mode intervention, character chat, faction council debates |
| **Analytics** | Faction power timeline (Recharts), genome evolution chart, D3 force-directed relationship graph |
| **Export** | Chronicle (epic narrative), Campaign Kit (TTRPG module), Session Prep (GM plan), **Download World** (full Markdown export for Obsidian/Notion) |
| **Theming** | Light/dark mode toggle with warm parchment (light) and dark leather (dark) themes, localStorage persistence, 30+ theme-aware components |
| **Integration** | Telegram bot, SSE streaming, hermes-agent MCP bridge, autonomous agent with start/stop/status/logs API |

---

## The Genome System

Every character carries 6 genetic traits: **courage, cunning, loyalty, ambition, empathy, resilience** (each 0.0–1.0).

- Traits drive events: high courage wins battles, high cunning wins intrigue, low loyalty enables betrayal
- Children inherit traits via crossover (50% from each parent) + 10% mutation chance
- Low-fitness characters die off — natural selection reshapes the population over generations
- After 100+ days, you can see the population evolve: worlds that reward cunning breed cunning people

Source: [`backend/simulation.py`](backend/simulation.py)

---

## Real Use Cases

### For TTRPG Game Masters

D&D/Pathfinder GMs spend **4-8 hours** prepping a world before session zero. Genesis does it in **60 seconds** from one sentence.

**Workflow:** Type "Norse mythology where Ragnarok approaches" → Genesis builds 6 regions, 4 factions, 15 characters with genomes, and 4 prophecies → Simulate 30 days to develop faction tensions → Hit **Download World** → Drop the Markdown file into **Obsidian or Notion** → Run session zero tonight.

What you get:
- **Campaign Kit** — encounter tables per region, faction tension matrix, NPC stat blocks with personality traits, 3 ready-to-run plot hooks
- **Session Prep** — a structured GM plan for your next session with pacing, key NPCs to introduce, and decision points
- **Character Chat** — rehearse NPC dialogue before the table. Each character responds in-character shaped by their genome (high cunning = evasive answers, high loyalty = unwavering stance)
- **Faction Council** — simulate a political debate between faction leaders to preview how they'd react to player actions
- **Chronicle** — a narrative history of everything that happened in the world, publishable as in-world lore handouts

One sentence replaces hours of prep. The world is internally consistent because it was *simulated*, not written.

### For Writers & Worldbuilders

Writing a novel or building a fantasy world? Genesis generates **internally consistent** settings where events cause other events — not a random pile of lore.

**Workflow:** Describe your setting → Generate the world → Simulate 100+ days → Watch politics evolve, alliances form and shatter, characters rise and die → Export the chronicle as a **narrative draft** → Use it as the backbone of your story.

What you get:
- **Causal event chains** — "this betrayal triggered this war, which caused a succession crisis, which led to an unlikely alliance" — all emergent, not scripted
- **Character depth for free** — 196 characters with genetic personalities, relationship histories, and faction loyalties. Each one responds differently in Character Chat based on who they are
- **Genetic worldbuilding** — after 100 days, a world that rewards cunning breeds cunning people. The population itself tells a story about what kind of world this is
- **Download the entire world** as structured Markdown — geography, faction details, character profiles with genome stats, prophecies, timeline. Import into your worldbuilding wiki

### For Educators

Simulate geopolitical dynamics in real-time. Show students how civilizations actually work — not through a textbook, but through a **living model** they can interact with.

**Classroom applications:**
- **Political Science** — watch how alliances form and collapse, how power vacuums create instability, how faction ideology shapes behavior
- **Economics** — observe resource scarcity driving conflict, trade networks enabling alliances, economic power translating into political leverage
- **History** — "What if the Roman Empire had a succession crisis after Caesar?" Type it, simulate it, watch what emerges. Compare emergent outcomes to real history
- **Creative Writing** — students generate worlds, simulate them, then write narratives based on the events. Every student gets a unique world with its own internal logic
- **Game Theory** — the genome system is a live genetic algorithm. Students can watch natural selection reshape a population: worlds that reward courage breed warriors, worlds that reward cunning breed politicians

Every event has visible cause and effect in the timeline. The **Faction Power Chart** shows how power shifts over time. The **Relationship Graph** maps alliances and rivalries. Interactive, visual, shareable.

### For Game Designers & AI Researchers

Procedural narrative engine with genetic algorithms, multi-agent coordination, and emergent storytelling — all open source.

- **Extend it** — add new event types, new genome traits, new faction behaviors. The simulation engine is modular
- **Benchmark it** — 941 events generated autonomously across 323 days. Test your own LLM against Hermes-4-70B on structured world generation
- **Study emergence** — no event is scripted. Watch how simple rules (genome-weighted event selection + fitness-based survival) produce complex narrative arcs
- **Fork the agent** — the World Master implements observe→reason→act. Swap in your own reasoning engine and compare outcomes

---

## Quick Start

```bash
# Fastest: Docker (recommended)
git clone https://github.com/Ridwannurudeen/hermes-genesis
cd hermes-genesis
cp .env.example .env    # add your NOUS_API_KEY
docker compose up -d    # http://localhost:8003
```

Or try the **[live demo](https://hermesgenesis.world)** — no setup required.

<details>
<summary>Manual setup (without Docker)</summary>

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # add your NOUS_API_KEY
uvicorn main:app --reload --port 8003

# Frontend (new terminal)
cd frontend
npm install && npm run dev
```

</details>

| Variable | Required | Description |
|---|---|---|
| `NOUS_API_KEY` | Yes | NousResearch inference API key |
| `TELEGRAM_BOT_TOKEN` | No | For Telegram bot integration |
| `PORT` | No | Defaults to `8003` |

---

## How Hermes-4-70B Powers Each Component

| Component | What Hermes Does |
|---|---|
| **World Generation** | Creates geography, factions, characters, and prophecies from one sentence |
| **Event Simulation** | Generates events weighted by character genomes, faction dynamics, and causality chains |
| **Event Narration** | Writes vivid prose for each event based on character traits and world state |
| **World Master Agent** | Observes, reasons, decides to simulate, intervene, or focus — then sees consequences |
| **Divine Intervention** | Interprets natural language commands ("destroy the capital") and applies structured effects |
| **Character Chat** | Responds in-character shaped by genome, faction loyalty, and personal history |
| **Faction Council** | Each leader argues their position based on current power dynamics and relationships |
| **Prophecy Fulfillment** | Detects when world events match prophecy conditions, marks them fulfilled |
| **Chronicle / Campaign** | Writes publishable narrative histories and TTRPG campaign modules from world state |

---

## Architecture

```
  hermes-agent CLI / Gateway          Hermes-4-70B (NousResearch API)
         |                                       |
    MCP Protocol                                 |
         |                                       |
  +------v--------+                              |
  | MCP Bridge    |   mcp-bridge/server.mjs      |
  | (11 tools)    |   genesis_*, agent_*          |
  +------+--------+                              |
         |                                       |
     REST API                                    |
         |                                       |
     +---v---------------v-----------------------+
     |     FastAPI Backend         |        29 API endpoints
     |     Python 3.11             |        SSE streaming
     |                             |        71 tests
     |  World Generation           |        backend/generator.py
     |  Simulation Engine          |        backend/simulation.py
     |  Autonomous Agent           |        backend/autonomous_agent.py
     |  Genetic Evolution          |        backend/simulation.py
     |  Prophecy Checker           |        backend/prophecy_checker.py
     |  Telegram Bot               |        backend/telegram_bot.py
     +--------------+--------------+
                    |
     +--------------v--------------+
     |     React 18 Frontend       |        29 code-split chunks
     |     TypeScript + Tailwind   |        Framer Motion animations
     |                             |
     |  Theater Mode (Stage View)  |        components/TheaterMode.tsx
     |  Cinematic Mode (Fullscreen)|        components/CinematicMode.tsx
     |  Procedural Ambient Sound   |        hooks/useAmbientSound.ts
     |  Voice Narration            |        hooks/useVoiceNarration.ts
     |  Cinematic World Map (SVG)  |        components/WorldMap.tsx
     |  D3 Relationship Graph      |        components/RelationshipGraph.tsx
     |  God Mode / Chronicle       |        pages/WorldView.tsx
     +-----------------------------+

  5 Custom Skills (skills/)
  world-master | genesis-create | genesis-chat | genesis-chronicle | mcp-server
```

---

## Tech Stack

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![D3](https://img.shields.io/badge/D3.js-7.9-F9A03C?style=flat-square&logo=d3.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Hermes](https://img.shields.io/badge/NousResearch-Hermes--4--70B-8B5CF6?style=flat-square)

[**71 tests**](backend/tests/) | **29 code-split chunks** | [**29 API endpoints**](backend/routes/) | **Deployed on VPS**

---

## Roadmap

**v1.0 (Hackathon)** — Core simulation, Theater Mode, Cinematic Mode, ambient sound, voice narration, autonomous World Master, genetic evolution, God Mode, character chat, faction council, chronicle export, campaign kit, session prep, Telegram bot

**v1.1** — Multiplayer worlds (shared persistence), voice-to-world (speak your world into existence), PDF export for print-ready TTRPG modules, mobile-responsive UI

**v2.0** — Community world sharing marketplace, live AI dungeon master mode for TTRPG sessions over Discord/Roll20, classroom mode (teacher controls simulation, students observe and interact), genetic drift analysis tools for researchers

---

## Built for the NousResearch Hermes Agent Hackathon

Hermes Genesis demonstrates what Hermes Agent can do when given full creative control over a living world. The World Master implements hermes-agent's observe→reason→act pattern, 5 custom skills integrate with the hermes-agent framework, and an MCP bridge connects the entire simulation to hermes-agent's tool ecosystem.

Every character decision, every faction power shift, every prophecy fulfilled — all driven by Hermes-4-70B reasoning over structured world state through the agent framework.

A GM preps tonight's session in 60 seconds. A writer exports a chronicle and starts drafting chapter one. A teacher simulates the fall of an empire in front of the class. A researcher forks the genome system and benchmarks emergence.

The world doesn't wait for you. It lives on its own. And when you're ready — you take it with you.

---

MIT License
