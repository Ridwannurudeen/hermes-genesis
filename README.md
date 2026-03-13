# HERMES GENESIS

**Describe a world. Watch it live. Watch it die.**

An autonomous living world engine. You type one sentence — "a dying kingdom where magic is fading" — and it builds a complete civilization: regions, factions, characters with DNA, and ancient prophecies. Then the world runs itself. Wars erupt, alliances form, leaders are betrayed, children are born with mutated traits, and an AI god watches from above, steering the story toward dramatic moments.

No scripting. No prompting. The world just... lives.

**Live Demo:** [http://75.119.153.252:8003](http://75.119.153.252:8003)

---

## What Happens When You Create a World

1. **You describe it** — "Norse mythology where Ragnarok approaches" or "cyberpunk megacity with corporate warfare"
2. **It builds itself** — geography, factions with ideologies, characters with genetic traits, and 4 cryptic prophecies
3. **It comes alive** — every day, events happen: battles, political intrigue, betrayals, alliances, discoveries, births, deaths
4. **Events cause events** — a betrayal triggers a war, which causes a succession crisis, which leads to an alliance. Nothing is random
5. **An AI agent governs** — the World Master watches, reasons about narrative arcs, and intervenes when the story needs it. It chases prophecy fulfillment on its own
6. **Characters evolve** — offspring inherit traits from parents through genetic crossover + mutation. Over generations, the population shifts: a world that rewards cunning breeds cunning people

---

## What You Can Do

- **Just watch** — toggle auto-play and the world advances every 8 seconds with events exploding on the map
- **Play god** — type "destroy the capital" or "assassinate the king" and watch the consequences ripple out
- **Talk to characters** — chat with anyone in-world; they respond based on their personality, faction loyalty, and lived history
- **Read the story** — generate an epic chronicle of your world's history, export it as markdown
- **Prep a D&D session** — get a full campaign module or GM session plan from your world's current state

---

## The Demo World: Crossroads of Hermes

Our flagship world, themed around Hermes the trickster god:

- **317 days** of autonomous history
- **928 events** — wars, betrayals, prophecies, births, deaths
- **194 characters** across 4 factions (48 have died)
- **101 chain reactions** — events causing events causing events
- **4/4 prophecies fulfilled** — including "Titan's Wrath Unleashed," a volcanic eruption the AI agent triggered to fulfill an ancient prophecy
- **Factions:** Nightshade Syndicate, Emberstone Legion, Silk Road Cartel, Oracle Guardians

Open it in the live demo and explore the history.

---

## What Makes This Different

| Other AI Projects | Hermes Genesis |
|---|---|
| Generate static text/images | Living simulation with real state that changes |
| Need constant prompting | Runs autonomously — no human input needed |
| No memory between outputs | Characters remember, factions accumulate territory, events chain |
| Thin LLM wrapper | Structured simulation engine with genetic evolution, causality chains, and prophecy tracking |
| AI responds | AI *acts* — the World Master has its own agenda |

---

## How Hermes-4-70B Powers Everything

| Component | What Hermes Does |
|---|---|
| **World Generation** | Creates geography, factions, characters, and prophecies from one sentence |
| **Event Narration** | Writes vivid prose for each event based on character genomes and world state |
| **World Master Agent** | Observes, reasons, decides to simulate, intervene, or focus — then sees consequences |
| **Divine Intervention** | Interprets "destroy the capital" and applies real effects (casualties, territory, deaths) |
| **Character Chat** | Responds in-character shaped by genome, faction loyalty, and personal history |
| **Prophecy Fulfillment** | Detects when world events match prophecy conditions, marks them fulfilled |
| **Chronicle / Campaign** | Writes publishable narrative histories and TTRPG campaign modules |
| **Obituaries** | Memorial text for fallen characters based on their life events |

---

## The Genome System

Every character carries 6 genetic traits: **courage, cunning, loyalty, ambition, empathy, resilience** (each 0.0–1.0).

- Traits drive events: high courage wins battles, high cunning wins intrigue, low loyalty enables betrayal
- Children inherit traits via crossover (50% from each parent) + 10% mutation chance
- Low-fitness characters die off — natural selection reshapes the population over generations
- After 100+ days, you can see the population evolve: worlds that reward cunning breed cunning people

---

## Quick Start

```bash
# Clone
git clone https://github.com/Ridwannurudeen/hermes-genesis
cd hermes-genesis

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

**Docker:**
```bash
cp .env.example .env    # add NOUS_API_KEY
docker compose up -d    # http://localhost:8003
```

| Variable | Required | Description |
|---|---|---|
| `NOUS_API_KEY` | Yes | NousResearch inference API key |
| `TELEGRAM_BOT_TOKEN` | No | For Telegram bot integration |
| `PORT` | No | Defaults to `8003` |

---

## Architecture

```
         Hermes-4-70B (NousResearch API)
                    │
     ┌──────────────▼──────────────┐
     │     FastAPI Backend         │
     │     Python 3.11             │
     │                             │
     │  World Generation           │
     │  Simulation Engine          │
     │  Autonomous Agent           │
     │  Genetic Evolution          │
     │  Prophecy Checker           │
     │  Telegram Bot               │
     │  30+ API endpoints          │
     │  SSE Streaming              │
     └──────────────┬──────────────┘
                    │
     ┌──────────────▼──────────────┐
     │     React 18 Frontend       │
     │     TypeScript + Tailwind   │
     │                             │
     │  Cinematic World Map (SVG)  │
     │  Event Animations           │
     │  D3 Relationship Graph      │
     │  Faction Power Charts       │
     │  Auto-play Mode             │
     │  Voice Narration            │
     │  God Mode / Chronicle       │
     └────────────────────────────┘
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

**70 tests** | **24 code-split chunks** | **30+ API endpoints** | **Deployed on VPS**

---

## Built for the NousResearch Hermes Agent Hackathon

Hermes Genesis demonstrates what happens when you give an AI full creative control over a living world. Every character decision, every faction power shift, every prophecy fulfilled — all driven by Hermes-4-70B reasoning over structured world state.

The world doesn't wait for you. It lives on its own.

---

MIT License
