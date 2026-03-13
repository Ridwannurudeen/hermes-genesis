# HERMES GENESIS

**Describe a world. Watch it live.**

An autonomous living world engine powered by NousResearch Hermes-4-70B. Give it a sentence — it generates a complete civilization with factions, characters, and genetic trait systems, then keeps the world evolving autonomously. Characters make decisions driven by their genome, factions rise and fall, alliances form and shatter, and the AI agent pursues its own narrative arcs across days.

**Live Demo:** [http://75.119.153.252:8003](http://75.119.153.252:8003)

---

## Features

### Core Engine
- **World Generation from Natural Language** — one prompt produces geographic regions, factions with ideologies and territory, characters with 6-trait genetic genomes, and cryptic prophecies
- **Genome-Driven Simulation** — military conflicts, political intrigue, betrayals, alliances, discoveries, and successions resolve based on character genome traits (courage, cunning, loyalty, ambition, empathy, resilience)
- **Genetic Evolution** — characters reproduce via crossover + mutation, natural selection culls low-fitness individuals, population trait distributions shift across generations
- **Prophecy System** — generated at world creation, prophecies foreshadow events that may unfold as the simulation progresses

### Autonomous Intelligence
- **True Autonomous Agent** — an AI agent observes world state, reasons about narrative potential, and takes real actions: triggering simulations, executing divine interventions, or focusing events on specific factions/characters. The agent maintains multi-day narrative arcs and pursues prophecy fulfillment
- **God Mode (Divine Intervention)** — natural language commands that alter the world: "Destroy the capital", "Forge an alliance between rivals", "Assassinate the king" — the LLM interprets and applies effects to factions, territories, characters
- **Faction Council** — AI-driven council where faction leaders debate strategy, propose alliances, and threaten rivals based on current world state

### Interactive Experience
- **SVG World Map** — D3.js interactive map with faction-colored territories, character positions, event markers with death/birth/conflict animations
- **Cinematic Mode** — fullscreen map with auto-simulation, voice narration (Web Speech API), and animated event title cards. Watch your world unfold like a documentary
- **World Replay** — replay the entire history of your world as a cinematic documentary, events playing back day-by-day with narration
- **Character Chat** — talk to any character in-world; they respond in character based on their genome, faction, and personal history
- **Voice Narration** — zero-dependency text-to-speech narrates events as they happen

### Analytics & Export
- **Faction Power Timeline** — Recharts area chart tracking territory, population, and morale across days. Watch empires rise and fall
- **Genome Evolution Tracker** — per-generation trait averages visualized as line charts showing population-level genetic drift
- **Character Relationship Graph** — D3 force-directed graph showing alliances, rivalries, family bonds, and mentorships between characters
- **Chronicle Export** — LLM generates an epic narrative history of your world (800-1500 words), downloadable as markdown
- **Campaign Kit** — full TTRPG campaign module with hooks, encounters, NPCs, and session structure
- **Session Prep** — instant GM session plan with read-aloud text, 3 encounters, and a cliffhanger

### Integration
- **Telegram Bot** — link your world to [@hermesgenesis_bot](https://t.me/hermesgenesis_bot). Get event notifications, check world status, and trigger simulation from Telegram
- **SSE Streaming** — real-time Server-Sent Events for world generation progress and simulation events

---

## The Genome System

Every character carries a genome of six traits, each a float in [0.0, 1.0]:

```
courage  |  cunning  |  loyalty  |  ambition  |  empathy  |  resilience
```

**How it works:**

1. **Trait-weighted events** — military conflicts favor `courage` + `resilience`; political intrigue favors `cunning` + `ambition`; betrayals are driven by low `loyalty` and high `ambition`
2. **Crossover reproduction** — offspring inherit traits from both parents with 50% probability per trait
3. **Mutation** — each inherited trait has a 10% chance of Gaussian perturbation (`±N(0, 0.1)`)
4. **Fitness scoring** — characters score on survival, influence, goal completion, and relationships:

   ```
   fitness = 0.30 * survival + 0.25 * influence + 0.25 * goals + 0.20 * relationships
   ```

5. **Natural selection** — characters below fitness threshold die, removing their genome from the pool
6. **Population drift** — over generations, the world's aggregate trait distribution shifts; a world that rewards cunning eventually breeds cunning populations

---

## How Hermes-4-70B Powers It

Every decision in the engine is driven by Hermes-4-70B via the NousResearch inference API:

| Component | What Hermes Does |
|---|---|
| **World Generation** | Creates geography, factions, characters, and prophecies from a single seed sentence |
| **Event Simulation** | Narrates each day's events — battles, betrayals, alliances — considering character genomes and world state |
| **Autonomous Agent** | Observes world state, reasons about narrative arcs, decides actions (simulate/intervene/focus) |
| **Divine Intervention** | Interprets natural language god commands and applies structured effects |
| **Character Chat** | Responds in-character with personality shaped by genome, faction loyalty, and lived experience |
| **Faction Council** | Generates multi-faction debate with each leader arguing from their faction's position |
| **Chronicle / Campaign Kit** | Writes publishable narrative histories and complete TTRPG campaign modules |
| **Obituaries** | Writes memorial text for fallen characters based on their life events |

---

## Quick Start

**Prerequisites:** Python 3.11+, Node 20+, a NousResearch API key

### Local Dev

```bash
# Clone
git clone https://github.com/Ridwannurudeen/hermes-genesis
cd hermes-genesis

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # add your NOUS_API_KEY
uvicorn main:app --reload --port 8003

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

### Docker (production)

```bash
cp .env.example .env             # add NOUS_API_KEY and TELEGRAM_BOT_TOKEN
docker compose up -d
# API + frontend served at http://localhost:8003
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NOUS_API_KEY` | Yes | NousResearch inference API key |
| `NOUS_BASE_URL` | No | Defaults to `https://inference-api.nousresearch.com/v1` |
| `NOUS_MODEL` | No | Defaults to `Hermes-4-70B` |
| `DATA_DIR` | No | World state storage path, defaults to `data/worlds` |
| `TELEGRAM_BOT_TOKEN` | No | Required for Telegram bot integration |
| `PORT` | No | API port, defaults to `8003` |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/worlds` | List all worlds |
| `POST` | `/api/worlds` | Create a world from seed text |
| `GET` | `/api/worlds/{id}` | Full world state |
| `DELETE` | `/api/worlds/{id}` | Delete a world |
| `GET` | `/api/worlds/{id}/map` | Geography + faction territory |
| `GET` | `/api/worlds/{id}/factions` | All factions |
| `GET` | `/api/worlds/{id}/characters` | All characters with genomes |
| `GET` | `/api/worlds/{id}/characters/{cid}` | Single character detail |
| `GET` | `/api/worlds/{id}/events?day=N` | Events, optionally filtered by day |
| `GET` | `/api/worlds/{id}/evolution` | Per-generation trait averages |
| `GET` | `/api/worlds/{id}/prophecies` | World prophecies |
| `GET` | `/api/worlds/{id}/faction-timeline` | Faction power snapshots over time |
| `POST` | `/api/worlds/{id}/simulate?days=N` | Simulate N days with LLM narrative (max 30) |
| `POST` | `/api/worlds/{id}/simulate/quick?days=N` | Simulate N days without narrative (max 100) |
| `POST` | `/api/worlds/{id}/intervene` | Divine intervention (natural language command) |
| `POST` | `/api/worlds/{id}/characters/{cid}/chat` | Chat with a character in-world |
| `POST` | `/api/worlds/{id}/council` | Faction council debate |
| `POST` | `/api/worlds/{id}/chronicle` | Generate epic narrative history |
| `POST` | `/api/worlds/{id}/campaign-kit` | Generate TTRPG campaign module |
| `POST` | `/api/worlds/{id}/session-prep` | Generate GM session plan |
| `POST` | `/api/worlds/{id}/agent/start` | Start autonomous agent |
| `POST` | `/api/worlds/{id}/agent/stop` | Stop autonomous agent |
| `GET` | `/api/worlds/{id}/agent/status` | Agent running status |
| `GET` | `/api/worlds/{id}/agent/logs` | Agent decision logs |
| `POST` | `/api/worlds/stream` | SSE: stream world generation progress |
| `POST` | `/api/worlds/{id}/simulate/stream` | SSE: stream simulation events |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Hermes-4-70B (NousResearch)                │
│                   inference-api.nousresearch.com              │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────▼─────────────────┐
          │        FastAPI Backend            │
          │        Python 3.11               │
          │                                  │
          │  generator.py     (world birth)  │
          │  simulation.py    (daily ticks)  │
          │  autonomous_agent (AI agent)     │
          │  models/genome.py (evolution)    │
          │  telegram_bot.py  (notifications)│
          │                                  │
          │  30+ API endpoints               │
          │  SSE streaming                   │
          │  JSON repair + retry             │
          └────────────────┬─────────────────┘
                           │
          ┌────────────────▼─────────────────┐
          │       React 18 Frontend           │
          │       TypeScript + Tailwind       │
          │                                  │
          │  WorldMap         (D3.js SVG)    │
          │  MapEventMarkers  (animations)   │
          │  CinematicMode    (fullscreen)   │
          │  RelationshipGraph(D3 force)     │
          │  FactionPowerChart(Recharts)     │
          │  CharacterChat    (in-world)     │
          │  AutonomousAgent  (AI control)   │
          │  ChronicleModal   (story export) │
          │  CampaignKitModal (TTRPG)       │
          │  SessionPrepModal (GM prep)      │
          │  VoiceNarration   (Web Speech)   │
          └──────────────────────────────────┘
```

---

## Tech Stack

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![D3](https://img.shields.io/badge/D3.js-7.9-F9A03C?style=flat-square&logo=d3.js&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-2.12-22B5BF?style=flat-square)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-11-E91E63?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Hermes](https://img.shields.io/badge/NousResearch-Hermes--4--70B-8B5CF6?style=flat-square)

---

## Built for the NousResearch Hermes Agent Hackathon

Hermes Genesis demonstrates what happens when you give an AI full creative control over a living world. Every character decision, every faction power shift, every prophecy fulfilled — all driven by Hermes-4-70B reasoning over structured world state.

---

## License

MIT
