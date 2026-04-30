# Hermes Genesis / Chroniclon Hackathon and Grant Audit

Date: 2026-04-30
Scope: local repo, backend API, Chroniclon pipeline, frontend demo surfaces,
Hermes Agent/MCP integration, deployment posture, test coverage, and prize fit.

## Executive Verdict

This project is genuinely competitive, but it only wins if the submission is
framed as an agentic creative system, not as an AI world generator.

The strongest sentence is:

> One sentence in; an autonomous Hermes Agent turns it into a living
> civilization that writes, critiques, cross-links, illustrates, narrates, and
> evolves its own encyclopedia.

Current quality after this audit:

| Area | Score | Verdict |
|---|---:|---|
| Creativity | 9/10 | Strong enough for first-place conversation. |
| Usefulness | 8/10 | Strong for writers, TTRPGs, lore teams, education; needs clearer buyer path. |
| Presentation | 8/10 | Good surfaces exist; demo must lead with Control Room and proof. |
| Hermes Agent fit | 8.5/10 | Skills + MCP + autonomous loop are real; make tool traces visible. |
| Kimi-track fit | 8/10 | Kimi path exists; video must prove it directly on screen. |
| Security | 7.5/10 | Much stronger after fixes; still not grant-grade auth. |
| Grant readiness | 7/10 | Strong prototype; needs repeatable deploy, metrics, and user workflow. |

Blunt answer: this can win a hackathon if the demo lands. It is not yet
grant-ready as production infrastructure because auth is still a shared demo
token model, not real account/admin auth.

## What Was Fixed In This Pass

### Security and Privacy

- Private worlds are now actually private across world detail, map, factions,
  characters, events, prophecies, export, evolution, faction timeline, agent
  status, and agent logs.
- Mutating API-key middleware now covers `PATCH`, not only `POST` and `DELETE`.
- Expensive model routes now have endpoint-specific rate limits:
  - world creation
  - world streaming creation
  - live regen
  - audience submission
  - simulation
  - intervention
  - chronicle/campaign/session generation
  - scene image
  - Chroniclon image/audio render
- Static-file path confinement now uses `commonpath` instead of raw prefix
  matching.
- Tracked-file secret scan now passes.
- `.env.example` now documents `GENESIS_API_KEY`, CORS origins, trusted proxy
  IPs, max worlds, and TTS keys.

### Demo Reliability

- `/demo` phase ladder now listens for the actual backend progress stages:
  `simulating` and `canonizing`.
- Hermes Agent standalone demo now:
  - reads `GENESIS_API_URL`
  - forwards `GENESIS_API_KEY`
  - URL-encodes LLM/tool-controlled path segments
  - sends interval as the backend query parameter
  - raises on failed API responses instead of summarizing broken JSON
- `setup-hermes-agent.sh` now forwards `GENESIS_API_KEY` into MCP config when
  present and no longer interpolates unescaped shell variables into Python code.
- Shell scripts are forced to LF via `.gitattributes`; `bash -n` passes.

### Correctness

- Chroniclon store now respects runtime `CHRONICLON_DIR`, fixing stale import
  config in tests and local runs.
- Chroniclon media routes now read `CHRONICLON_DIR` dynamically too.
- Succession chain logic now keeps internal succession internal, so leadership
  can actually transfer.
- Streaming world creation now re-checks `MAX_WORLDS` after acquiring the
  creation semaphore.
- Frontend Vite security advisories were fixed by upgrading the toolchain and
  updating chunk configuration for Vite 8.

## Verified Test Matrix

Local checks run after the fixes:

| Check | Result |
|---|---|
| `python -m pytest backend\tests -q` | 128 passed |
| `python -m bandit -r backend -ll -ii` | no medium/high issues |
| `python -m pip_audit -r backend\requirements.txt` | no known vulnerabilities |
| `npm audit --audit-level=moderate` in frontend | 0 vulnerabilities |
| `npm audit --audit-level=moderate` in mcp-bridge | 0 vulnerabilities |
| `npm run build` in frontend | passed |
| `node --check mcp-bridge/server.mjs` | passed |
| `python -m py_compile hermes-agent-demo.py` | passed |
| `bash -n setup-hermes-agent.sh deploy/deploy.sh` | passed |
| local browser smoke for `/`, `/chronicle`, `/regen`, `/control`, `/demo` | passed earlier in this audit session |

## Remaining Risks That Could Cost The Win

### 1. Shared SPA API key is not real security

The Docker flow forwards `GENESIS_API_KEY` into the frontend build so the SPA can
call mutating routes. That is fine as a hackathon demo gate, but not as
production auth. Anyone can extract a built `VITE_` key from the browser bundle.

Grant-grade fix:

- Add server-side sessions or wallet/email admin auth.
- Keep `GENESIS_API_KEY` only for server-to-server jobs and MCP.
- Put public demo writes behind per-IP, per-session, and per-feature quotas.

### 2. Live regen is powerful but expensive

One `/regen` request can generate a world, simulate days, and canonize multiple
articles. I tightened the limiter to 3/min/IP, but for production this should
also have:

- queueing
- cancel buttons wired to backend task cancellation
- per-session daily quota
- precomputed judge fallback
- cost telemetry

### 3. The pitch can still look too broad

The repo includes world generation, simulation, wiki, TTS, images, Telegram,
campaign tools, MCP, skills, and contribution loops. That is impressive, but it
can confuse judges in a short demo.

Winning rule:

Do not demo everything. Demo one spine:

1. Control Room shows Hermes deciding.
2. Kimi writes.
3. Hermes critics score.
4. Cross-links appear.
5. Article autopsy proves causal simulation.
6. Regen proves it works on any seed.

### 4. Model provenance must be undeniable

Kimi-track eligibility needs visible proof. Do not rely on README claims.

Video should show:

- writer selector set to `Kimi K2.6`
- article row badge `Kimi-K2.6`
- Control Room stage with model labels
- README architecture table for one second
- optional terminal or network log showing Kimi provider if safe

### 5. Grant story needs a customer, not only a demo

Grant reviewers ask: who uses this repeatedly after the hackathon?

Best grant angle:

- "Persistent creative-world infrastructure for writers, TTRPG creators,
  game studios, and educators."
- Output is reusable: wiki pages, campaign kits, session prep, Markdown export,
  language evolution, character/faction continuity.
- Agent value: the world keeps producing canon without constant prompting.

## Winning Demo Plan

### The 75-second video

0-5s:
Show the seed sentence. No explanation.

5-15s:
Cut to Control Room, not landing page. Show live agent phases moving.

15-30s:
Open article detail. Show title, voice, word count, Kimi badge, critics,
cross-links, image/audio if present.

30-45s:
Open Civilization Autopsy. Show source event, ancestors, descendants, faction
effects. This proves it is not just a text generator.

45-60s:
Run `/demo` or `/regen` with Kimi selected. Show `world_ready`,
`linguistic_drift`, and `article_canonized`.

60-75s:
End on the claim:
"Hermes decides canon. Kimi writes canon. Hermes critiques canon. The
civilization keeps publishing."

### What not to show

- Do not start on a marketing landing page.
- Do not spend time explaining generic world generation.
- Do not click every feature.
- Do not wait silently for LLM latency.
- Do not show raw errors or empty article states.

## Wow Features That Would Most Increase Win Probability

### P0: Judge Mode

Add a `/judge` route that is deterministic and safe:

- starts with Control Room
- uses a tested seed
- has precomputed fallback data if live APIs fail
- has a visible "Kimi proof" strip
- has one-click links: Control Room, latest article, autopsy, regen, repo

This is the highest-leverage feature left.

### P0: Article Provenance Panel

Each article should show:

- Canon decision model: Hermes-4-70B
- Writer model: Kimi-K2.6 or Hermes-4-70B
- Anti-slop score
- Fact-check score
- Revision count
- Cross-link count
- Source event ID

That turns invisible backend architecture into visible judging evidence.

### P1: Submission Pack Export

One button should generate:

- tweet text
- Discord submission text
- project one-liner
- architecture image or Mermaid diagram
- stats snapshot
- 3 article links

This helps both hackathon and grant follow-up.

### P1: Public Read-Only Showcase World

Keep a curated world public and make new user worlds unlisted/private. The
public homepage should always have content even if live generation is rate
limited or failing.

### P1: Cost Dashboard

Add admin-only counters:

- requests by endpoint
- estimated LLM calls
- regen count
- failed generations
- average article generation time

This is not flashy, but grants care about operational maturity.

### P2: Multi-World Gallery

Let judges compare 3 very different worlds:

- Lunar monarchy
- Memory island
- Language worship civilization

This proves generality without making them wait for live generation.

## Competitive Positioning

Likely competitor types:

1. AI video/image/audio demos: visually flashy but often shallow.
2. Creative writing tools: useful but not agentic.
3. 3D/game demos: interactive but hard to finish.
4. Agent tool demos: technical but not emotionally memorable.

Chroniclon's edge:

- It has emotional hook and technical depth.
- It uses agents over time, not just a one-shot prompt.
- It creates durable artifacts: articles, languages, eras, exports.
- It can visibly use Hermes and Kimi for different jobs.

Chroniclon's weakness:

- It risks looking like "lots of features" instead of one killer experience.
- If live generation stalls, the magic dies.
- If Kimi proof is not visible, Kimi-track eligibility looks weak.
- If auth/rate limits are misconfigured, a public demo can be sabotaged.

## Grant Readiness Gap

To look grant-worthy after the hackathon, add:

- real auth
- persistent user/project accounts
- background job queue
- usage/cost telemetry
- saved exports
- hosted showcase gallery
- contributor moderation queue UI
- CI pipeline for tests/build/audits
- short roadmap with concrete milestones

Suggested grant roadmap:

1. v0.1: hackathon demo, persistent autonomous canon, Kimi/Hermes provenance.
2. v0.2: user accounts, saved worlds, project dashboards, quotas.
3. v0.3: editor workflow: revise canon, branch timelines, export packs.
4. v0.4: marketplace: public worlds, community contributions, remixing.
5. v0.5: studio/education mode: classrooms, campaigns, collaborative lore.

## Brutal Final Answer

With the fixes from this audit, the codebase is no longer obviously fragile.
It is hackathon-competitive.

It is not automatically first-place. The remaining difference is presentation:
make the agent pipeline visible, make Kimi proof undeniable, and never let the
judge wait on a blank screen.

If the demo opens on Control Room, lands the article autopsy, and shows a fresh
Kimi-written regen, this can beat flashier projects because it has a stronger
combination of creativity, usefulness, and architecture.

If the demo opens like a normal worldbuilder and hides the agent machinery, it
will look good but not inevitable.
