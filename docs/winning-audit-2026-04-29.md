# Hermes Genesis / Chroniclon Winning Audit

Date: 2026-04-29
Scope: repo audit, live deployment checks, security review, hackathon judging fit,
Kimi-track readiness, demo strategy, and grant-readiness.

This is a blunt audit. The project is strong, but the current submission shape
does not yet force a first-place decision. The winning path is to make Chroniclon
feel less like a worldbuilding app with a wiki tab and more like a live creative
agent system: Hermes decides canon, Kimi writes canon, Hermes criticizes canon,
and the civilization keeps publishing while judges watch.

## External Judging Context

Public criteria from the hackathon announcement:

- Submissions are judged on creativity, usefulness, and presentation.
- Kimi-track eligibility requires proving use of Kimi models in the submission
  video.
- Submission is a demo video on X tagging Nous Research, plus Discord submission.

Hermes Agent positioning from official Nous sources:

- Hermes Agent is not only a model wrapper. It is positioned as an agent that
  lives on a server, has skills, memory, scheduled automations, messaging
  gateways, tool use, and MCP-style extensibility.
- Therefore, a winning submission should demonstrate agency over time, skills,
  tools, persistent state, and visible model/tool traces.

Implication: "AI worldbuilder" is not enough. "A persistent Hermes Agent that
turns simulated civilization into an evolving, Kimi-written canon archive" is
much stronger.

## Current Verdict

Current state:

- Main Track: finalist-worthy, not first-place-safe.
- Kimi Track: likely competitive only if Kimi provenance is made visible.
- Grant potential: high if pitched as persistent creative-world infrastructure.

Rating before fixes:

- Creativity: 8.5/10
- Usefulness: 7/10
- Presentation: 6.5/10
- Security/deployment readiness: 4/10
- Kimi-track proof: 5/10
- Hermes-Agent proof: 6/10

Rating after the must-fixes and Canon Control Room:

- Creativity: 9/10
- Usefulness: 8.5/10
- Presentation: 9/10
- Security/deployment readiness: 7.5/10
- Kimi-track proof: 9/10
- Hermes-Agent proof: 9/10

## What Is Strong

### 1. The core idea is genuinely good

"One sentence in, a civilization's encyclopedia out" is a strong hook. It fits
creative domains, long-form writing, interactive media, worldbuilding, and agent
autonomy. Chroniclon is more novel than a typical "generate a story" hackathon
project because it creates a persistent cultural archive.

### 2. The project already has real scope

The repo includes:

- FastAPI backend
- React/Vite frontend
- Genesis simulation
- Chroniclon canon runner
- Hermes-oriented skills
- MCP bridge
- live deployment
- tests
- demo docs
- Kimi article writer path
- Hermes critic loop
- linguistic drift
- contribution queue
- world export/campaign kit/session prep

This is much more than a thin wrapper around an LLM.

### 3. Tests and build are healthy

Verified locally:

- `python -m pytest backend\tests -q`: 90 passed
- `npm run build` in `frontend`: passed

The repo claim says 71 tests in README, but the current count is better: 90.
Update the README because stale stats make judges doubt the rest of the claims.

### 4. The Chroniclon pipeline has real agent architecture

The good pipeline:

1. Hermes decides if an event should become canon.
2. Kimi writes the long-form article.
3. Hermes anti-slop critic scores prose quality.
4. Hermes fact-check critic scores canon consistency.
5. Hermes proposes cross-links.
6. Article is persisted into the wiki.

Relevant code:

- `backend/chroniclon/canon_agent.py`
- `backend/chroniclon/article_writer.py`
- `backend/chroniclon/critics.py`

This is the project's biggest judging advantage. It needs to be visible in the
UI and video.

## Critical Findings

### P0-1: Production API is publicly mutable and auth is disabled

Evidence:

- `https://hermesgenesis.world/api/health` returns `auth_required:false`.
- `http://hermesgenesis.world:8003/api/health` also responds directly.
- `http://75.119.153.252:8003/api/health` also responds directly.
- Local `.env` has no `GENESIS_API_KEY`.
- `docker-compose.yml` maps `"8003:8003"`, exposing the container port.

Impact:

- Anyone can create worlds, simulate worlds, start agents, delete worlds, and
  trigger LLM-cost endpoints if they know the API.
- Anyone can bypass nginx security assumptions by hitting port 8003 directly.
- This is cost abuse, vandalism, data integrity risk, and demo sabotage risk.

Relevant files:

- `backend/main.py`
- `docker-compose.yml`
- `deploy/nginx.conf`

Required fix:

- Set `GENESIS_API_KEY` in production.
- Remove query-parameter API keys; use `X-API-Key` only.
- Bind backend to localhost in compose:

```yaml
ports:
  - "127.0.0.1:8003:8003"
```

- Add firewall rule to block public port 8003.
- Add `CORS_ORIGINS=https://hermesgenesis.world`.
- Confirm after deploy:

```bash
curl https://hermesgenesis.world/api/health
curl http://75.119.153.252:8003/api/health
```

Expected:

- domain health says `auth_required:true`
- raw IP:8003 is unreachable

### P0-2: CORS is permissive in production

Evidence:

- `Origin: https://evil.example` receives `access-control-allow-origin: *`.
- `backend/main.py` defaults to `["*"]` when `CORS_ORIGINS` is absent.

Impact:

- Browser-based abuse of public APIs is easier.
- It weakens the story that this is production-ready.

Required fix:

- Set `CORS_ORIGINS=https://hermesgenesis.world`.
- Keep local permissive only in local dev.
- Add a test that production config cannot boot without explicit CORS origins
  when `ENV=production`.

### P0-3: Rate limiter trusts spoofable X-Forwarded-For

Evidence:

- `backend/rate_limit.py` uses the first `x-forwarded-for` value before
  `request.client.host`.
- Direct port 8003 is exposed, so attackers can set arbitrary XFF.

Impact:

- Rate limit can be bypassed by changing request headers.
- Cost endpoints remain vulnerable under load.

Required fix:

- If behind nginx, only nginx should set `X-Forwarded-For`.
- App should trust XFF only when `request.client.host` is `127.0.0.1` or a
  configured proxy IP.
- Add nginx `limit_req` for `/api/worlds/*/simulate`, `/api/chronicle/regen`,
  `/api/worlds`, `/api/scene-image`, and agent endpoints.

### P0-4: MCP bridge is broken against current backend routes

Evidence:

- MCP `genesis_create_world` calls `POST /api/worlds/generate`.
- Backend create route is `POST /api/worlds`.
- MCP `genesis_chat` calls `/api/worlds/{id}/chat`.
- Backend chat route is `/api/worlds/{id}/characters/{char_id}/chat`.
- MCP `genesis_council` sends a body with `topic`; backend currently ignores a
  topic and accepts no request body.

Impact:

- The README claims Hermes Agent integration and 11 MCP tools, but some of the
  most important tools fail or are semantically wrong.
- This is dangerous for judging. If judges try the MCP story and it breaks, the
  "Hermes Agent" angle collapses.

Required fix:

- Update `mcp-bridge/server.mjs` routes to match backend.
- Add `GENESIS_API_KEY` support in MCP bridge headers.
- Add `mcp-bridge/package-lock.json`.
- Add `npm test` or `node smoke.mjs` that exercises every MCP tool against a
  local mocked API or a test backend.

### P0-5: Kimi proof is invisible and fallback can undermine track eligibility

Evidence:

- `article_writer.py` defaults `provider="kimi"`.
- `llm.py` falls back to Nous if Kimi key is absent.
- Article model does not store writer provider/model.
- UI does not show model provenance per article.

Impact:

- Kimi track requires proof in the submission video.
- "We used Kimi" is weaker than showing per-article receipts.
- Fallback behavior is good for resilience but bad for proof unless surfaced.

Required fix:

Add provenance to `WikiArticle`:

- `writer_provider`
- `writer_model`
- `writer_request_id` if available
- `critic_provider`
- `critic_model`
- `canon_decider_model`
- `created_from_event_id`

Then show a small "Model Provenance" block in the article page:

```text
Canon decision: Hermes-4-70B
Article writer: Kimi K2.6
Anti-slop critic: Hermes-4-70B
Fact-check critic: Hermes-4-70B
Cross-link agent: Hermes-4-70B
```

This is the single most important Kimi-track improvement.

## High Findings

### P1-1: Dependency audits currently fail

Verified:

- Frontend npm audit: 5 vulnerabilities, including high findings in transitive
  lodash/picomatch and moderate Vite/PostCSS/esbuild findings.
- Python pip audit: `python-dotenv` and Starlette vulnerabilities.
- MCP bridge cannot be audited because it has no lockfile.

Required fix:

- Update `python-dotenv` to `>=1.2.2`.
- Update FastAPI far enough to pull Starlette `>=0.47.2`, then rerun tests.
- Update Vite/PostCSS and lock transitive fixes.
- Generate and commit `mcp-bridge/package-lock.json`.

### P1-2: Public API leaks user-created seeds, including possible PII

Evidence:

- `/api/worlds` is public.
- Live world seeds include user-entered raw text. Some look like phone-number
  style inputs.

Impact:

- Publicly exposing raw user prompts can leak personal data.
- This is bad for a grant story and eventually needs privacy controls.

Required fix:

- Public list should return curated/public worlds only.
- Add `visibility` to worlds: `private`, `unlisted`, `public`.
- Hide or redact raw seeds unless the creator opts in.
- Add delete/moderation controls for abusive or accidental content.

### P1-3: README and live stats are inconsistent

Examples:

- README says 71 tests; actual backend tests are 90.
- Demo script says record after 80+ articles; live Chroniclon stats currently
  show 52 articles.
- README proof-of-scale uses older Crossroads numbers and days.

Impact:

- Stale claims make a judge question whether the project is maintained.
- The video script currently asks for more data depth than the live site shows.

Required fix:

- Update README with current test count.
- Run Chroniclon to at least 80 articles before recording.
- Make the demo script pull live numbers from `/api/chronicle/stats`.

### P1-4: Chroniclon is the best feature but not the default first impression

The README opens with Chroniclon, but the live landing page still mainly sells
Hermes Genesis. Chroniclon is a banner, not the primary experience.

Impact:

- Judges may see "world generation app" instead of "self-writing civilization
  wiki powered by Hermes + Kimi".
- Many competitors will have flashy creative generation. The canonical wiki is
  the differentiator, so it should be front and center.

Required fix:

- Make `/chronicle` the submission URL.
- Or make the landing hero explicitly Chroniclon:

```text
CHRONICLON
A civilization that writes its own encyclopedia.
Hermes decides canon. Kimi writes it. Hermes fact-checks it.
```

### P1-5: Language drift is visually interesting but linguistically shallow

Live lexicon currently looks like mostly mechanical spelling substitutions.
That is okay for a prototype, but "language evolves across eras" is a major wow
claim and needs more depth.

Required fix:

- Add explicit phonological rules per era.
- Add morphology: plural, honorific, place-name suffixes.
- Generate in-world inscriptions with translations.
- Make the UI show parent -> child sound changes as a real tree, not just a
  list of changed words.

### P1-6: Network graph screenshot looks sparse

The relationship graph is a good feature, but the current screenshot has many
isolated nodes and only one visible edge. It does not visually sell "living
society".

Required fix:

- Demo a world/day with dense relationships.
- Add toggles: alliances, rivals, family, mentor, killers, betrayed-by.
- Add "most central character" and "most dangerous faction" callouts.
- Animate new edges when events happen.

## Medium Findings

### P2-1: Query-param API keys should be removed

`api_key` query params leak into logs, browser history, proxies, and analytics.
Use `X-API-Key` only.

### P2-2: Security headers are incomplete

Nginx has old basic headers, but no obvious CSP and no HSTS in the checked
config. Add:

- `Strict-Transport-Security`
- `Content-Security-Policy`
- `Permissions-Policy`
- `Referrer-Policy` already exists

### P2-3: Public submissions are listed without auth

`GET /api/chronicle/submissions` is public. It is empty now, but once users
submit content it may expose pending moderation data.

Fix:

- Public should see canonized contributors only.
- Pending queue should require admin auth.

### P2-4: File-backed JSON storage will not scale to grant usage

It is fine for hackathon. It is not fine for hosted multi-user production.

Grant roadmap should include:

- SQLite/Postgres
- background job queue
- content-addressed article versions
- backups
- moderation state
- owner/visibility controls

### P2-5: Audio and image generation are not strongly tied to Chroniclon

Cinematic Mode is visually impressive, but Chroniclon's article pages lack
illustrations/audio in the live data. The strongest demo would show articles
with:

- generated illustration
- narrated audio
- model provenance
- canon score
- cross-links

## Winning Product Reframe

Do not pitch this as:

"A worldbuilding app."

Pitch it as:

"A persistent creative agent that turns simulated history into a living,
cross-linked, Kimi-written encyclopedia. Hermes decides what becomes canon,
Hermes criticizes it, and the world keeps publishing after I leave."

That frame is more aligned with Hermes Agent than the generic world-generator
frame.

## Must-Build: Canon Control Room

This is the feature that can make the demo first-place competitive.

Add a page or panel showing the live canon pipeline:

1. New event arrives from Genesis simulation.
2. Hermes canon agent chooses accept/skip.
3. Hermes chooses article kind, voice, title, target length.
4. Kimi writes the article.
5. Hermes anti-slop critic scores it.
6. Hermes fact-check critic scores it.
7. Hermes cross-link agent inserts links.
8. Article appears in the wiki.

UI structure:

```text
Event: The Quillspire Schism
  -> Canon decision: ACCEPTED by Hermes-4-70B
  -> Voice: newspaper
  -> Writer: Kimi K2.6
  -> Anti-slop: 0.84
  -> Fact-check: 0.91
  -> Cross-links: 7
  -> Published: /chronicle/the-quillspire-schism
```

Why this matters:

- It proves Hermes Agent behavior.
- It proves Kimi model usage.
- It makes "agentic creative pipeline" obvious in 10 seconds.
- It turns invisible backend work into a showpiece.

## Other Wow Features Worth Adding

### 1. Model Provenance Receipts

Every article should carry a visible receipt:

- model used
- agent role
- scores
- source event
- era
- generated timestamp

This is necessary for Kimi track.

### 2. One-Click Civilization Dossier

Export:

- world overview
- timeline
- key factions
- top characters
- language tree
- selected wiki articles
- campaign hooks
- model provenance

Target users:

- writers
- TTRPG GMs
- educators

This turns the project from "cool demo" into "useful product".

### 3. Audience Canonization Loop

The existing contribution modal is promising but unfinished as a judging story.

Winning version:

- viewer submits event
- Hermes moderates
- Hermes checks contradiction
- Kimi rewrites into canon voice
- article is credited to viewer
- contributor count increments live

This gives judges something to do.

### 4. Civilization Autopsy

For any article/event, show:

- why it happened
- which prior events caused it
- which factions changed
- which character traits mattered
- what future prophecies it affects

This makes the simulation feel causal instead of just generative.

### 5. Era Transition Ceremony

When an era closes, make it a cinematic event:

- old era summary
- new era title
- changed phonology
- new lexicon
- dominant factions
- generated seal/banner

This is a strong video moment.

## Presentation Plan

The video must not be a feature tour. It should be a story.

Recommended 75-second structure:

1. 0-5s: "I gave Hermes one sentence."
2. 5-12s: show Chroniclon stats and article list.
3. 12-25s: open Canon Control Room. Show Hermes -> Kimi -> Hermes pipeline.
4. 25-38s: open a Kimi-written article with provenance receipt.
5. 38-50s: click cross-links and language tree.
6. 50-62s: run live regen on a new seed.
7. 62-75s: export dossier / final statement.

Required on-screen proof:

- "Writer: Kimi K2.6"
- "Canon agent: Hermes-4-70B"
- "Anti-slop critic: Hermes-4-70B"
- "Fact-check critic: Hermes-4-70B"
- Kimi API/model config or runtime provenance visible for 2-3 seconds

## Grant Pitch

Grant thesis:

"Chroniclon is infrastructure for persistent AI-authored fictional universes:
agents that simulate, remember, canonize, revise, cite, and export worlds over
weeks or months."

Grant milestones:

1. Multi-user hosted worlds with auth and visibility controls.
2. Durable storage and versioned canon history.
3. Model provenance and article audit trails.
4. Roll20/Discord/Notion/Obsidian integrations.
5. Marketplace of public civilizations and campaign modules.
6. Hermes Agent skill pack for creative studios.
7. Evaluation suite for canon consistency, slop, causal coherence, and user
   usefulness.

Why Nous/Kimi should care:

- It showcases long-running Hermes Agent autonomy.
- It uses Kimi for long-form creative output where long context matters.
- It creates public artifacts people can read, share, and remix.
- It can become a benchmark for creative agents, not just a toy app.

## 24-Hour Action Plan

Must do before recording:

1. Lock down production API.
2. Block raw port 8003.
3. Fix MCP bridge routes.
4. Add model provenance fields to articles.
5. Show Kimi model badges in UI.
6. Run Chroniclon to 80+ articles.
7. Update README stats.
8. Fix dependency audits or at least document patched versions.
9. Record Canon Control Room flow.

## 48-Hour Action Plan

If time remains:

1. Build contribution canonization loop.
2. Improve language drift depth.
3. Add article audio/illustration to at least 3 showcase articles.
4. Add one-click dossier export.
5. Add live demo seed route that is fast and reliable.

## Final Judgment

The project can win, but not by being "a big app." It wins by making one idea
unmistakable:

"Hermes is not just answering prompts. Hermes is running a civilization's canon.
Kimi is writing the civilization's literature. The result keeps growing after
the human leaves."

Everything in the submission should serve that sentence.
