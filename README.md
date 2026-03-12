# HERMES GENESIS

**Describe a world. Watch it live.**

An autonomous living world engine built on NousResearch hermes-agent. Give it a sentence — it generates a complete civilization, deploys a visual explorer, and keeps the world evolving whether you're watching or not.

---

## What It Does

- **World generation from natural language** — one prompt produces 6 geographic regions, 4 factions with ideologies, and 15 characters with unique genetic trait genomes
- **Interactive web explorer** — SVG map with faction territory control, faction dashboards, character profiles, genome radar charts, event timelines
- **Autonomous simulation** — military conflicts, political intrigue, betrayals, alliances, discoveries, and successions unfold based on character genomes
- **Genome evolution** — characters reproduce via crossover + mutation, natural selection culls low-fitness characters, population traits shift across generations
- **Narrative delivery via Telegram** — the world sends you dispatches; events narrated by Hermes-4-70B

---

## Screenshots

> Screenshots coming — run it yourself with the quick start below.

---

## How hermes-agent Powers It

| hermes-agent Feature | How Genesis Uses It |
|---|---|
| `delegate_task` | Parallel subagents generate geography, factions, and characters simultaneously — 3x faster world creation |
| `cronjob` | Schedules autonomous simulation ticks (every hour by default) — world evolves without user interaction |
| `send_message` | Telegram narrative delivery — Hermes narrates each day's key events to your phone |
| `memory` | Cross-session world state persistence — pick up any world across agent sessions |
| `skill_manage` | Two registered skills (`genesis-worldbuilder`, `genesis-simulator`) that improve with use |
| `execute_code` | Python simulation engine runs genome crossover, fitness scoring, and event resolution |
| `terminal` | Deployment — spins up the FastAPI + React stack on any VPS |

---

## The Genome System

Every character carries a genome of six traits, each a float in [0.0, 1.0]:

```
courage  |  cunning  |  loyalty  |  ambition  |  empathy  |  resilience
```

**How it works:**

1. **Trait-weighted events** — military conflicts favor `courage` + `resilience`; political intrigue favors `cunning` + `ambition`; betrayals are driven by low `loyalty` and high `ambition`
2. **Crossover reproduction** — when characters form alliances or successions, offspring inherit traits from both parents with 50% probability per trait
3. **Mutation** — each inherited trait has a 10% chance of Gaussian perturbation (`±N(0, 0.1)`)
4. **Fitness scoring** — characters score on survival, influence, goal completion, and relationships:

   ```
   fitness = 0.30 * survival + 0.25 * influence + 0.25 * goals + 0.20 * relationships
   ```

5. **Natural selection** — characters below fitness threshold die, removing their genome from the pool
6. **Population drift** — over generations, the world's aggregate trait distribution shifts; a world that rewards cunning eventually breeds cunning populations

The evolution endpoint tracks average trait values per generation, visualized as line charts in the frontend.

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
| `TELEGRAM_BOT_TOKEN` | No | Required for autonomous narrative delivery |
| `PORT` | No | API port, defaults to `8003` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    hermes-agent                          │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │ genesis-worldbld │    │   genesis-simulator       │   │
│  │ skill v1.0.0     │    │   skill v1.0.0            │   │
│  │                  │    │                           │   │
│  │ delegate_task ──────> 3 parallel subagents        │   │
│  │ (geo/faction/chr)│    │ simulate_tick()           │   │
│  └────────┬─────────┘    └──────────┬────────────────┘   │
│           │                         │                    │
│    POST /api/worlds          POST /api/worlds/{id}       │
│           │                  /simulate?days=N            │
│           │                         │                    │
│      cronjob (hourly) ──────────────┘                   │
│      send_message (Telegram narrative)                   │
└───────────────────────┬─────────────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │       FastAPI Backend       │
          │       Python 3.11          │
          │                            │
          │  /api/worlds               │
          │  /api/worlds/{id}/simulate │
          │  /api/worlds/{id}/map      │
          │  /api/worlds/{id}/factions │
          │  /api/worlds/{id}/characters│
          │  /api/worlds/{id}/events   │
          │  /api/worlds/{id}/evolution│
          │                            │
          │  simulation.py             │
          │  generator.py              │
          │  models/genome.py          │
          └─────────────┬──────────────┘
                        │
          ┌─────────────▼──────────────┐
          │      React 18 Frontend      │
          │                            │
          │  WorldMap (D3.js SVG)      │
          │  FactionDashboard          │
          │  CharacterList + Detail    │
          │  GenomeRadar (Recharts)    │
          │  EventTimeline             │
          │  EvolutionView             │
          └────────────────────────────┘
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/worlds` | List all worlds |
| `POST` | `/api/worlds` | Create a world from seed text |
| `GET` | `/api/worlds/{id}` | Full world state |
| `GET` | `/api/worlds/{id}/map` | Geography + faction territory |
| `GET` | `/api/worlds/{id}/factions` | All factions |
| `GET` | `/api/worlds/{id}/characters` | All characters with genomes |
| `GET` | `/api/worlds/{id}/characters/{char_id}` | Single character |
| `GET` | `/api/worlds/{id}/events?day=N` | Events, optionally filtered by day |
| `GET` | `/api/worlds/{id}/evolution` | Per-generation trait averages |
| `POST` | `/api/worlds/{id}/simulate?days=N` | Simulate N days with LLM narrative (max 30) |
| `POST` | `/api/worlds/{id}/simulate/quick?days=N` | Simulate N days without narrative (max 100) |
| `DELETE` | `/api/worlds/{id}` | Delete a world |

---

## hermes-agent Skills

Two skills are included in `/skills/` and register automatically with hermes-agent:

**`genesis-worldbuilder`** (`skills/genesis-worldbuilder/SKILL.md`)
Generates a complete world from a natural language concept using `delegate_task` for parallel subagent generation. Optionally schedules autonomous simulation via `cronjob`.

**`genesis-simulator`** (`skills/genesis-simulator/SKILL.md`)
Advances a world by any number of days, produces narrative summaries, and highlights evolutionary trends across generations.

---

## Tech Stack

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![D3](https://img.shields.io/badge/D3.js-7.9-F9A03C?style=flat-square&logo=d3.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Hermes](https://img.shields.io/badge/NousResearch-Hermes--4--70B-8B5CF6?style=flat-square)

---

## License

MIT
