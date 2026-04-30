# Chroniclon — VPS Deploy Runbook

Hybrid deploy: Chroniclon ships as additive code in the existing Hermes
Genesis container, plus a separate `chroniclon-runner` Compose service for
the long-horizon canon agent. The runner shares the `/opt/genesis/data`
volume so it can read worlds and write articles, but runs in its own
process so a 144-hour LLM loop cannot crash the demo web service.

**Target VPS**: `root@75.119.153.252` (Contabo, where Hermes Genesis already lives).

## Budget defaults (already locked in code)

To stay safe on a $10 Kimi balance:

- **Target volume**: ~150 articles, not 500. Quality > quantity.
- **Kimi K2.6** is used ONLY for canon article bodies (where 256K context
  for cross-article continuity matters).
- **Hermes-4** handles linguistic drift, Moon X dispatches, regen demos,
  canon agent decisions, and all critic loops (it's free for our purposes).
- **Revision thresholds** tightened to reduce double-Kimi-call rate:
  anti-slop 0.45, fact-check 0.60.
- **K2.6 quirks**: temperature locked to 1.0 (it ignores other values),
  max_tokens floor of 1500 (reasoning consumes 400-800 tokens before
  content). Both handled silently in `llm.py`.

Realistic burn for 150 articles: ~$3-6. Always check Moonshot's usage
dashboard during Step 6's smoke test before committing to the long run.

## Pre-flight

You need:
- SSH access to `75.119.153.252`
- `KIMI_API_KEY` from `platform.moonshot.ai`
- `NOUS_API_KEY` already on the VPS (Hermes Genesis uses it)
- `IMAGE_API_KEY` already on the VPS (Together AI / FLUX)
- `jq` on the VPS (`apt install jq` if missing)

## Step 1 — Push the branch

From local:
```bash
cd "C:/Users/HP/Desktop/Github files/hermes-genesis"
git add -A
git commit -m "chroniclon: autonomous wiki engine (Days 0-6)"
git push origin chroniclon
```

## Step 2 — Pull on VPS and add the Kimi key

```bash
ssh root@75.119.153.252
cd /opt/genesis
git fetch origin
git checkout chroniclon
git pull origin chroniclon

# Append Kimi config to .env (do NOT overwrite existing keys)
cat <<'EOF' >> .env
KIMI_API_KEY=REPLACE_WITH_MOONSHOT_API_KEY
KIMI_BASE_URL=https://api.moonshot.ai/v1
KIMI_MODEL=kimi-k2.6
CHRONICLON_DIR=/app/data/chroniclon
CHRONICLON_WORLD_ID=
EOF
# Now edit .env and paste the real Kimi key
nano .env
```

## Step 3 — Rebuild the web service

This deploys the new chronicle routes + frontend pages + skill packaging,
without yet starting the runner.

```bash
docker compose down
docker compose up -d --build genesis
docker compose logs -f genesis-api    # ctrl-c after you see "Uvicorn running"
```

Verify the new routes are live:
```bash
curl -s http://localhost:8003/api/chronicle/stats | jq
# expect: {"article_count":0,"total_words":0,"era_count":0,...}
```

## Step 4 — Generate the canonical world (one-time)

The submission seed is locked in `backend/chroniclon/seed.py`:

> *A world where the moon is sentient and writes letters to the queen.*

Generate the world that the canon agent will document:

```bash
WORLD=$(curl -s -X POST http://localhost:8003/api/worlds \
  -H "Content-Type: application/json" \
  -d '{
    "seed": "A world where the moon is sentient and writes letters to the queen.",
    "num_regions": 5,
    "num_factions": 4,
    "num_characters": 12
  }' | jq -r .id)

echo "world_id: $WORLD"
# Save it
sed -i "s|^CHRONICLON_WORLD_ID=.*|CHRONICLON_WORLD_ID=$WORLD|" /opt/genesis/.env
```

This call takes 60–120 seconds (geography → factions → characters → prophecies).

## Step 5 — Pre-simulate so the runner has events on day 0

Run 15 in-world days of simulation (smaller than original plan to keep
Kimi spend bounded — target ~150 articles total, not 500):

```bash
curl -s -X POST "http://localhost:8003/api/worlds/$WORLD/simulate" \
  -H "Content-Type: application/json" \
  -d '{"days": 15}' | jq '.events | length'
```

## Step 6 — Smoke-test the runner with a hard cap before going long

This is the **most important step** — verify burn rate against the
Moonshot dashboard before committing to a 144-hour run.

```bash
cd /opt/genesis
# Process FIVE events only and exit. Watch the dashboard.
docker compose --profile canon run --rm chroniclon-runner \
  python -m chroniclon.runner --world-id $CHRONICLON_WORLD_ID --once --max-events 5
```

Expected: 5 events processed in ~3-5 minutes, ~50-80k tokens burned on
Moonshot (≈$0.30-0.60). Open `platform.moonshot.ai/console/usage` and
confirm the actual spend matches.

**STOP HERE if burn rate is more than 2x my estimate.** Tighten further
before continuing. Common levers: lower `word_count_target` defaults in
`backend/chroniclon/prompts.py:canon_decision_prompt`, or raise
`should_review_close` threshold so eras close less often.

## Step 7 — Light up the canon runner for real

```bash
docker compose --profile canon up -d chroniclon-runner

# Watch the canon write itself
docker compose logs -f chroniclon-runner
```

Expected first-hour logs (rough):
```
chroniclon.runner   {world_id}: 87 new events to consider
chroniclon.runner   bootstrapped The Founding Era
canon_agent         skip canonize: A minor border skirmish — too small
canon_agent         canonized: [event] The First Lunar Letter (1247 words, slop=0.78, fact=1.00)
chroniclon.era      era transition: The Founding Era → The Cinder Age (year 4)
canon_agent         canonized: [person] Queen Aelis the Younger (892 words, slop=0.82, fact=0.95)
...
```

## Step 8 — Verify from the wiki page

Open `http://hermesgenesis.world/chronicle` (or whatever your Genesis
domain is) — the stats banner should show `article_count` climbing every
~30 seconds, eras populating in the sidebar, and articles appearing in the
list. The page polls stats every 8 seconds.

## Step 9 — Optional: enable Moon X presence

**Only after** ~10 articles are canonized (so the Moon has things to
react to). The Moon stays in dry-run by default; she will not post until
explicitly enabled.

```bash
# Set X creds (use ShieldBot pay-as-you-go account credentials, or new account)
cat <<'EOF' >> /opt/genesis/.env
X_BEARER_TOKEN=...
X_CONSUMER_KEY=...
X_CONSUMER_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
MOON_X_HANDLE=@she_who_writes
MOON_X_LIVE=1
MOON_X_DRY_RUN=0
EOF

# Eyeball the dry-run audit log first to see what she WOULD have posted:
docker exec genesis-api cat /app/data/chroniclon/moon/audit.log | tail -20
# If the dispatches read OK, restart with MOON_X_LIVE=1
docker compose restart genesis chroniclon-runner
```

(The Moon poster runs inside the genesis-api process via a separate cron-style
async loop — to be wired in Day 6 polish if needed.)

## Step 10 — Optional: enable audio chapter render

```bash
echo "TTS_PROVIDER=elevenlabs"           >> /opt/genesis/.env
echo "ELEVENLABS_API_KEY=..."            >> /opt/genesis/.env
echo "ELEVENLABS_MODEL=eleven_multilingual_v2" >> /opt/genesis/.env
docker compose restart genesis
```

To render the audio chapter:
```bash
docker exec genesis-api python -m chroniclon.audio_chapter \
  --slug "the-first-lunar-letter" \
  --output /app/data/chroniclon/audio/chapter01.mp3
# (audio_chapter CLI is a Day 6 polish item)
```

## Operational cheats

| Need | Command |
|---|---|
| Live runner logs | `docker compose logs -f chroniclon-runner` |
| Pause the runner | `docker compose stop chroniclon-runner` |
| Resume after pause (cursor remembers where it was) | `docker compose --profile canon up -d chroniclon-runner` |
| Restart the runner without losing canon | `docker compose restart chroniclon-runner` |
| Wiki stats | `curl -s localhost:8003/api/chronicle/stats \| jq` |
| Article count by era | `curl -s 'localhost:8003/api/chronicle/eras' \| jq '.items[] \| {name, ordinal}'` |
| Reset entire canon (DESTRUCTIVE — keeps Genesis worlds) | `docker exec genesis-api rm -rf /app/data/chroniclon` |
| Backup canon | `docker exec genesis-api tar czf /app/data/chroniclon-$(date +%F).tgz /app/data/chroniclon` |

## Rollback

If anything is wrong, the chroniclon code is purely additive — no Genesis
files were modified except `main.py` (one line to register the router) and
`config.py` (Kimi env vars). Roll back with:

```bash
cd /opt/genesis
docker compose --profile canon down chroniclon-runner
git checkout main
docker compose up -d --build genesis
```

Existing Genesis worlds and the previous hackathon submission are untouched.
