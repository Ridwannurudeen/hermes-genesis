<div align="center">

# Hermes Genesis

### A wikipedia for a world that doesn't exist

An autonomous fiction engine. One sentence in, a self-writing canon out — three AI agents publish a fictional Wikipedia, illustrate it, narrate it, and let the language drift across centuries. The civilization keeps publishing whether anyone's watching.

[![Live](https://img.shields.io/badge/Live-hermesgenesis.world-B8893A?style=for-the-badge)](https://hermesgenesis.world)
[![Hermes-4-70B](https://img.shields.io/badge/Hermes--4--70B-NousResearch-8B5CF6?style=flat-square)](https://github.com/NousResearch)
[![Kimi K2.6](https://img.shields.io/badge/Kimi--K2.6-Moonshot-D4A85F?style=flat-square)](https://moonshot.ai)
[![FLUX](https://img.shields.io/badge/FLUX-BlackForestLabs-1A1208?style=flat-square)](https://blackforestlabs.ai)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-narration-CDB890?style=flat-square)](https://elevenlabs.io)
[![License](https://img.shields.io/badge/License-MIT-4F7240?style=flat-square)](LICENSE)

[**Live →**](https://hermesgenesis.world) ·
[**Watch →**](https://hermesgenesis.world/watch) ·
[**Glossary →**](https://hermesgenesis.world/glossary) ·
[**Demo film**](docs/X_THREAD.md) ·
[**Paper outline**](docs/PAPER_OUTLINE.md)

</div>

<p align="center">
  <img src="docs/screenshots/landing.png" alt="Editorial landing — featured article + live counter + freshness pulse" width="100%">
  <br>
  <em>Editorial front door — Source Serif 4 + JetBrains Mono on warm paper, magazine-style featured article, live article counter that flashes when the canon publishes.</em>
</p>

---

## What it does

- **Autonomous publishing pipeline.** Three Hermes-4-70B agents and one Kimi-K2.6 long-form writer collaborate to canonize, draft, score, and revise articles about a simulated civilization. Pass → seal. Fail → revise. Skip-rate ~40% — the canon agent says *no* a lot.
- **Real linguistic drift.** Each in-world era has its own phonological rules and lexicon. `karim` (Lunar) → `cherim` (Cinder) → `cherim-en` (Ash) tracks a /k/ → /tʃ/ palatalization across centuries. Sample texts and inscriptions in every era's tongue.
- **Multimedia by default.** FLUX-illustrated articles, ElevenLabs voice narration with character-genome-mapped archetypes, mood-themed cinematic playback per event type.
- **Provenance everywhere.** Every published article traces back to the simulation event that birthed it. Critic scores (anti-slop, fact-check) on every page. Cross-linked canon. RSS, OG cards, sitemap.
- **Hermes Agent native.** 9 repo-local skills + MCP bridge (17 tools) plug directly into [hermes-agent](https://github.com/NousResearch/hermes-agent). One-command setup.

## Live

```
960 canonized articles · 4 in-world eras · 65 linguistic eras
~1 article published every 2 minutes · publishing right now
```

[hermesgenesis.world](https://hermesgenesis.world) · [/watch](https://hermesgenesis.world/watch) · [/glossary](https://hermesgenesis.world/glossary) · [/control](https://hermesgenesis.world/control) · [/judge](https://hermesgenesis.world/judge)

---

## How it works

```
  World simulation                                Hermes-4-70B
  ────────────────                                ────────────
  geography · factions · genomes      ┌────►  Canon agent (decision)
  day-by-day events                   │           │
  auto-simulation when queue empties  │           ▼ canonize?
                                      │       Kimi-K2.6 writes long-form
                                      │           │
                                      │           ▼
                                      │       Hermes critics
                                      │       anti-slop · fact-check
                                      │           │
                                      │           ▼ pass / revise
                                      │       Cross-linker
                                      │           │
                                      │           ▼
                                      └─── Sealed article + provenance
                                                  │
                                                  ▼
                                       FLUX illustration · ElevenLabs narration
```

**Three agents, two models.** [`backend/chroniclon/canon_agent.py`](backend/chroniclon/canon_agent.py) is the orchestrator.

| Stage | Role | Model |
|---|---|---|
| **Canon decision** | Reads each event, decides if it deserves an article, picks kind/voice/length | Hermes-4-70B |
| **Long-form writer** | Writes 1,000–1,500 words in the era's voice with cross-links | Kimi-K2.6 |
| **Anti-slop critic** | Rejects formulaic prose, fourth-wall breaks, AI tells | Hermes-4-70B |
| **Fact-check critic** | Cross-references claims against the existing canon | Hermes-4-70B |
| **Cross-linker** | Inserts `[[wiki-style-links]]` to existing articles | Hermes-4-70B |
| **Era ticker + linguistic drift** | Closes eras, opens next, derives next-era phonology + lexicon | Hermes-4-70B |
| **Illustration** | Era-art-style + character-genome-grounded hero image per article | FLUX |
| **Narration** | Multi-archetype TTS per character genome (5 voices) | ElevenLabs |

**Quality gates** that keep the canon clean:

- Slug-collision guard at the write layer
- Topic dedupe (Jaccard ≥ 0.7) before canonization
- Publish floor: anti-slop ≥ 0.55 + fact-check ≥ 0.55 (after one revision attempt)
- Slug-dedup at the list endpoint

---

## See it

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/article-detail.png" alt="Article detail with drop cap, FLUX hero, ElevenLabs narration, critic-score colophon"><br>
      <b>Article detail</b> — drop cap, gilt rule, FLUX hero, ElevenLabs narration, critic-score colophon, provenance sidebar
    </td>
    <td width="50%">
      <img src="docs/screenshots/chronicle-home.png" alt="Chronicle archive — magazine list with audio + art badges"><br>
      <b>Chronicle archive</b> — 960 articles, era nav, critic scores, audio + art badges, inline play buttons
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/control-room.png" alt="Live canon control room — pipeline streaming"><br>
      <b>Control Room</b> — every canonization streams live: canon agent → writer → critics → illustrator → narrator
    </td>
    <td width="50%">
      <img src="docs/screenshots/regen.png" alt="Regen — SSE-streamed world creation from one sentence"><br>
      <b>Regen</b> — seed your own civilization, watch it canonize in real time (Kimi-K2.6 ↔ Hermes-4 toggle)
    </td>
  </tr>
</table>

> **Screenshots needing capture** before May 3 submission: `/watch` cinematic mode in editorial palette, `/glossary` linguistic family tree, lexicon-preview section on Landing, the new 8-item nav with freshness pill. The visuals above are post-reskin (Apr 30) but predate the May 1 push that added `/watch`, `/glossary`, and the lexicon preview.

---

## Quick start

```bash
git clone https://github.com/Ridwannurudeen/hermes-genesis
cd hermes-genesis
cp .env.example .env       # add NOUS_API_KEY (and optional KIMI / OPENAI / ELEVENLABS keys)
docker compose up -d       # http://localhost:8003
```

Or skip setup — the [live deployment](https://hermesgenesis.world) is the canonical artifact.

<details>
<summary>Manual setup (without Docker)</summary>

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8003

# Frontend
cd frontend
npm install && npm run dev
```

</details>

| Variable | Required | Notes |
|---|---|---|
| `NOUS_API_KEY` | Yes | Hermes-4-70B inference |
| `KIMI_API_KEY` | Recommended | Kimi-K2.6 for long-form writing (falls back to Nous if unset) |
| `IMAGE_API_KEY` | Optional | FLUX illustrations |
| `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` | Optional | TTS narration |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot |

---

## Hermes Agent integration

Ships as **9 hermes-agent skills** + an **MCP bridge** with **17 tools** + a **one-command setup**:

```bash
./setup-hermes-agent.sh                                  # local
./setup-hermes-agent.sh https://hermesgenesis.world      # remote
```

| Skill | Purpose |
|---|---|
| [`world-master`](skills/world-master/SKILL.md) | Full observe→reason→act loop, governs a living world autonomously |
| [`chroniclon`](skills/chroniclon/SKILL.md) | The canon agent + critics + writer + linguistic drift |
| [`genesis-create`](skills/genesis-create/SKILL.md) | World generation from one sentence |
| [`genesis-chat`](skills/genesis-chat/SKILL.md) | In-character conversations shaped by genome |
| [`genesis-chronicle`](skills/genesis-chronicle/SKILL.md) | TTRPG campaign kits + narrative exports |
| [`mcp-server`](skills/mcp-server/SKILL.md) | hermes-agent ↔ Genesis MCP setup |
| + 3 more | See [`skills/`](skills/) |

MCP bridge auto-discovered by hermes-agent via stdio:

```
genesis_create_world      genesis_simulate         genesis_intervene
genesis_chat              genesis_council          genesis_chronicle
chronicle_stats           chronicle_list_articles  chronicle_get_article
chronicle_render_audio    chronicle_render_image   chronicle_control_backlog
… 5 more
```

Source: [`mcp-bridge/server.mjs`](mcp-bridge/server.mjs) · [`hermes-agent-demo.py`](hermes-agent-demo.py).

---

## Stack

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.119-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)
![Remotion](https://img.shields.io/badge/Remotion-4.0-EF4444?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)

**Backend** — FastAPI · 60+ endpoints · SSE streaming · file-locked atomic JSON store · 71 tests
**Frontend** — React 18 · Source Serif 4 + JetBrains Mono · strict editorial palette · D3 · Framer Motion
**Infra** — Docker Compose (web + canon-runner) · nginx + certbot · GitHub Actions CI

---

## Demo film

A 32-second editorial demo accompanies the [X submission](docs/X_THREAD.md) — programmatic React composition (Remotion) rendered to mp4. ElevenLabs Antoni narration over a Kevin MacLeod (CC-BY-3.0) music bed; Seraphina narration takes the floor for 7 seconds during the proof beat. Video is the canonical artifact; the source composition lives outside this repo.

---

## Why Hermes-4-70B

This pipeline lives or dies on five Hermes capabilities:

1. **Uncensored creative reasoning.** The canon agent makes brutal calls — kill characters, end dynasties, cancel prophecies. No safety refusals.
2. **Multi-persona consistency.** Hundreds of characters with genome-shaped voices stay in character across articles.
3. **Structured reasoning over JSON state.** Every event arrives as 50+ fields. Hermes parses them without hallucinating.
4. **Long-context planning.** Prophecy fulfillment requires tracking conditions across hundreds of in-world days.
5. **Reliable structured output.** Every LLM call returns valid JSON; we parse every response programmatically.

Kimi-K2.6 carries the long-form writing because of its 256K context — the writer sees ~50 prior canon excerpts when drafting any article.

---

## Numbers from the live API

```
$ curl -s https://hermesgenesis.world/api/chronicle/stats
{
  "article_count":     960,
  "total_words":       1156842,
  "era_count":         4,
  "linguistic_eras":   65,
  "subscriber_count":  3,
  "last_canon_write":  "2026-05-01T11:42:08+00:00"
}
```

13 worlds running on the production VPS. The largest (Wellspring Kingdom) is on day 335. All events, all characters, all faction dynamics: autonomous. No scripting.

---

## What makes this different

|  | AI Dungeon | Stanford Smallville / AI Town | Hidden Door | **Hermes Genesis** |
|---|---|---|---|---|
| **Autonomy** | reactive only | simulation only | humans drive scenes | autonomous publishing |
| **Persistence** | none | session memory | per-game | full canon, indefinite |
| **Cross-temporal coherence** | none | none | per-session | cross-era cross-linked canon |
| **Linguistic depth** | none | none | none | phonological drift across eras |
| **Critic loop** | none | none | none | anti-slop + fact-check before publish |
| **Publishing artifact** | text fragment | none | scene transcript | encyclopedia |

The category as we frame it: *autonomous publishing of fictional canon with cross-temporal coherence and linguistic drift.* See [`docs/PAPER_OUTLINE.md`](docs/PAPER_OUTLINE.md) for the workshop-paper framing.

---

## Roadmap

| Stage | Status |
|---|---|
| Core simulation, autonomous canon, critic loop | ✅ Live |
| Multimedia (FLUX + ElevenLabs + cinematic mode) | ✅ Live |
| Linguistic drift module | ✅ Live |
| Hermes-agent skills + MCP bridge | ✅ Live |
| Editorial reskin + 8-route nav | ✅ Live |
| 32s programmatic demo film | ✅ Shipped |
| Workshop paper (NeurIPS Creative AI) | 🔧 Drafting |
| Multiplayer worlds (shared persistence) | 📋 Planned |
| Voice-to-world (speak your world into existence) | 📋 Planned |

---

## Built for the NousResearch Hermes Agent Hackathon

Hermes Genesis demonstrates what Hermes Agent can do when given full creative control over a living world. The World Master implements hermes-agent's observe→reason→act pattern, repo-local skills integrate with the framework, and the MCP bridge connects every layer of the simulation to hermes-agent's tool ecosystem.

Every character decision, every faction power shift, every prophecy fulfilled, every article sealed into the canon — all driven by Hermes-4-70B reasoning over structured world state through the agent framework.

A GM preps tonight's session in 60 seconds. A writer exports a chronicle and starts drafting chapter one. A teacher simulates the fall of an empire in front of the class. A researcher forks the genome system and benchmarks emergence.

The world doesn't wait for you. It lives on its own. And when you're ready — you take it with you.

---

## License

[MIT](LICENSE).

Demo-film music: *Inspired* by Kevin MacLeod ([incompetech.com](https://incompetech.com)) — Creative Commons Attribution 3.0.
