---
name: chroniclon
description: Turn an autonomous Hermes Genesis world into a self-writing wikipedia. Long-form articles, era-by-era linguistic drift, audience-contributed canon, all from a single seed.
version: 1.0.0
metadata:
  hermes:
    tags: [creative, longform, autonomous, kimi, wiki, civilization]
    category: creative
    requires_toolsets: [terminal, web]
    models: [Hermes-4-70B, Kimi-K2.6]
---

# Chroniclon — The Living Encyclopedia of a World That Doesn't Exist

## When to Use
When you want a Hermes Genesis world's events to become **primary-source articles** — wiki entries, court chronicles, scriptures, diaries — that cross-link, fact-check each other, and drift linguistically across eras. The output is a browseable civilizational archive that grows autonomously.

This skill pairs **Hermes-4-70B** (agent decisions, critic loops) with **Kimi K2.6** (long-form article generation, 256K context for cross-article continuity).

## Prerequisites
- Hermes Genesis running at `http://localhost:8003`
- A world generated via `genesis-create` (you'll have a `world_id`)
- `KIMI_API_KEY` set (otherwise long-form falls back to Hermes; quality drops)

## Procedure

### Step 1: Inspect the canon's current state
```bash
curl http://localhost:8003/api/chronicle/stats
```
Returns: `article_count`, `total_words`, `era_count`, `current_era`, `linguistic_eras`, `contributor_count`. Use these to track the autonomous run's progress.

### Step 2: Browse what's already canon
```bash
# Articles, optionally filtered by era / kind
curl 'http://localhost:8003/api/chronicle/articles?limit=50'
curl 'http://localhost:8003/api/chronicle/articles?era_id=era_2&kind=person'

# A single article (dereference by slug)
curl http://localhost:8003/api/chronicle/articles/queen-aelis-ii

# Era timeline
curl http://localhost:8003/api/chronicle/eras

# Linguistic family tree (drifted lexicon per era)
curl http://localhost:8003/api/chronicle/lexicon
```

### Step 3: Run the autonomous canon agent
The runner consumes Genesis events and decides which become articles, what voice they're written in, what they cross-link to. It self-paces and survives restarts via cursor files.

```bash
# Process all unprocessed events for a world and exit
python -m chroniclon.runner --world-id world_xxx --once

# Long-running: poll for new events forever
python -m chroniclon.runner --world-id world_xxx
```

The runner:
- Skips trivial events (filler skirmishes, repetitive disputes)
- Canonizes pivotal events (deaths, treaties, discoveries, prophecy fulfillments) as their own articles
- Routes long-form to Kimi K2.6, structured decisions to Hermes-4
- Runs adversarial critics (anti-slop + fact-check) and revises one pass if either scores low
- Cross-links new articles into existing canon
- Advances eras automatically when ~20-60 articles accumulate, generating linguistic drift

### Step 4: Live regen (proves the engine works on any seed)
```bash
curl -X POST http://localhost:8003/api/chronicle/regen/stream \
  -H "Content-Type: application/json" \
  -d '{"seed": "A world where the moon is sentient and writes letters to the queen.", "days": 5}' \
  --no-buffer
```
SSE stream emits: `progress`, `world_ready`, `era_opened`, `linguistic_drift`, `day_complete`, `article_canonized`, `complete`. ~3-6 articles in 60-90 seconds — enough for a demo recording.

### Step 5: Audience contribution (human-in-the-loop canon)
Public form posts to `/api/chronicle/submit` with a `contributor_handle` and `seed_text` (≤600 chars). The canon agent moderates each submission and either canonizes it as a wiki article (credited to `@handle`) or rejects it.

```bash
curl -X POST http://localhost:8003/api/chronicle/submit \
  -H "Content-Type: application/json" \
  -d '{"contributor_handle": "samczsun", "seed_text": "A meteor lands in the eastern desert and the lunar correspondence ceases for forty days."}'
```

### Step 6: The Moon X presence (optional)
If `MOON_X_LIVE=1` and X creds are set, the Moon character posts nightly dispatches and replies to humans grounded in current canon. Every post passes a safety critic before it ships.

```python
from chroniclon.moon import nightly_dispatch_cycle
import asyncio
asyncio.run(nightly_dispatch_cycle(world_name="Vael"))
# {"posted": True, "id": "1234567890"} or {"posted": False, "reason": "dry-run"}
```

## What's in the Box

| Component | Role | Model |
|-----------|------|-------|
| Canon agent | Decides if event → article, picks kind/voice/title | Hermes-4 |
| Article writer | Long-form, in-world, cross-linked | Kimi K2.6 |
| Anti-slop critic | Rejects formulaic prose, fourth-wall breaks | Hermes-4 |
| Fact-check critic | Scores against canon, flags hard contradictions | Hermes-4 |
| Cross-link agent | Inserts `[[slug]]` references at first occurrence | Hermes-4 |
| Era ticker | Closes eras at thresholds, opens next | Hermes-4 |
| Linguistic drift | Phonology + lexicon evolution, parent-era continuity | Kimi K2.6 |
| Moon X bot | Persona-driven X presence with safety gate | Kimi K2.6 + Hermes-4 |

## Verification
- `GET /api/chronicle/stats` returns `article_count > 0` after a run
- A random article (e.g. `GET /api/chronicle/articles/{some_slug}`) has `body_md`, `backlinks` populated, `anti_slop_score >= 0.55`, and `fact_check_score >= 0.7`
- `GET /api/chronicle/lexicon` returns at least one linguistic era; multi-era runs show parent_era chains
- The wiki at `/chronicle` renders without console errors and live-polls stats every 8 seconds

## Pitfalls
- The first ~5 articles per era have empty `inbound` (no prior articles to backlink). This is expected.
- Kimi rate limits at scale — the runner paces itself with `DEFAULT_INTER_EVENT_PAUSE_S = 4.0`. Increase for long unattended runs.
- The autonomous run is **stateful** in `data/chroniclon/` — back this up before re-running with a new seed, or it will write into the same canon.
- The Moon character posts nothing by default. Set `MOON_X_LIVE=1` explicitly when ready, after at least 10 articles have been canonized (or she has nothing to react to).
