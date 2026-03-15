# HERMES GENESIS

**Describe a world. Watch it live. Watch it die.**

An autonomous living world engine. You type one sentence — "a dying kingdom where magic is fading" — and it builds a complete civilization: regions, factions, characters with DNA, and ancient prophecies. Then the world runs itself. Wars erupt, alliances form, leaders are betrayed, children are born with mutated traits, and an AI god watches from above, steering the story toward dramatic moments.

No scripting. No prompting. The world just... lives.

**Live Demo:** [genesis.hermes-ouroboros.online](https://genesis.hermes-ouroboros.online)

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

- **Theater Mode** — watch events play out on a dramatic stage with curtains, spotlights, character sprites, faction-based positioning, and AI-generated scene images
- **Cinematic Mode** — fullscreen immersive experience with world map overlay, auto-simulation, procedural ambient sound, voice narration, and Ken Burns camera effects (live or replay)
- **Ambient Sound** — procedural Web Audio drones that shift mood per event type: aggressive sawtooth for war, ethereal sine pads for divine intervention, chaotic noise for disasters
- **Voice Narration** — events are read aloud with dramatic pacing via Web Speech API
- **Play God** — type "destroy the capital" or "assassinate the king" and watch the consequences ripple out
- **Talk to Characters** — chat with anyone in-world; they respond based on their personality, faction loyalty, and lived history
- **Faction Council** — summon faction leaders to debate and argue about world events
- **Read the Story** — generate an epic chronicle of your world's history, export it as markdown
- **Prep a D&D Session** — get a full campaign module or GM session plan from your world's current state
- **Just Watch** — toggle auto-play and the world advances every 8 seconds with events exploding on the map

---

## Features

| Category | Features |
|---|---|
| **Core Simulation** | World generation from natural language, genome-based character evolution, 13 event types, causality chains, prophecy tracking + fulfillment |
| **Autonomous Agent** | World Master AI with observe-reason-act loop, narrative arc planning, autonomous intervention, prophecy chasing |
| **Theater Mode** | Dramatic stage with curtains, spotlights, character sprites, faction-aware positioning, speech bubbles, AI scene images, auto-play scrubber |
| **Cinematic Mode** | Fullscreen world map overlay, live auto-simulation, history replay/documentary mode, event title cards with Ken Burns zoom |
| **Audio** | Procedural ambient sound (Web Audio API, 13 mood profiles, crossfade transitions), voice narration (Web Speech API) |
| **Interactive** | SVG world map with event markers, God Mode intervention, character chat, faction council debates |
| **Analytics** | Faction power timeline (Recharts), genome evolution chart, D3 force-directed relationship graph |
| **Export** | Chronicle (epic narrative), Campaign Kit (TTRPG module), Session Prep (GM plan) |
| **Integration** | Telegram bot, SSE streaming, autonomous agent with start/stop/status/logs |

---

## The Genome System

Every character carries 6 genetic traits: **courage, cunning, loyalty, ambition, empathy, resilience** (each 0.0-1.0).

- Traits drive events: high courage wins battles, high cunning wins intrigue, low loyalty enables betrayal
- Children inherit traits via crossover (50% from each parent) + 10% mutation chance
- Low-fitness characters die off — natural selection reshapes the population over generations
- After 100+ days, you can see the population evolve: worlds that reward cunning breed cunning people

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
| **Faction Council** | Each faction leader argues their position based on current power dynamics |
| **Prophecy Fulfillment** | Detects when world events match prophecy conditions, marks them fulfilled |
| **Chronicle / Campaign** | Writes publishable narrative histories and TTRPG campaign modules |
| **Obituaries** | Memorial text for fallen characters based on their life events |

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
                    |
     +--------------v--------------+
     |     FastAPI Backend         |
     |     Python 3.11             |
     |                             |
     |  World Generation           |
     |  Simulation Engine          |
     |  Autonomous Agent           |
     |  Genetic Evolution          |
     |  Prophecy Checker           |
     |  Telegram Bot               |
     |  29 API endpoints           |
     |  SSE Streaming              |
     +--------------+--------------+
                    |
     +--------------v--------------+
     |     React 18 Frontend       |
     |     TypeScript + Tailwind   |
     |                             |
     |  Theater Mode (Stage View)  |
     |  Cinematic Mode (Fullscreen)|
     |  Procedural Ambient Sound   |
     |  Voice Narration            |
     |  Cinematic World Map (SVG)  |
     |  D3 Relationship Graph      |
     |  Faction Power Charts       |
     |  God Mode / Chronicle       |
     |  Campaign Kit / Session Prep|
     |  29 code-split chunks       |
     +-----------------------------+
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

**71 tests** | **29 code-split chunks** | **29 API endpoints** | **Deployed on VPS**

---

## Built for the NousResearch Hermes Agent Hackathon

Hermes Genesis demonstrates what happens when you give an AI full creative control over a living world. Every character decision, every faction power shift, every prophecy fulfilled — all driven by Hermes-4-70B reasoning over structured world state.

The world doesn't wait for you. It lives on its own.

---

MIT License
