# AI Usage

Hermes Genesis uses four AI services in production. This document discloses what each one does, where it is invoked, and how to verify the integration.

---

## Models

### Hermes-4-70B — canon decisions and critic loop
**Provider:** Nous Research (`https://inference-api.nousresearch.com/v1`)
**Env:** `NOUS_API_KEY`, `NOUS_MODEL=Hermes-4-70B`
**Used in:**
- `backend/chroniclon/canon_agent.py` — the *canon agent* that reads every simulated event and decides whether it's article-worthy, picks article kind / voice / target length.
- `backend/chroniclon/critics.py` — the *anti-slop* and *fact-check* critics that score every drafted article before it is sealed into the canon.
- `backend/world_master.py` — the *World Master* loop that runs the observe → reason → act cycle over world state.
- `backend/chroniclon/regen.py` — seed-to-world generation when a user spawns a civilization from one sentence.

Hermes-4-70B is chosen for: uncensored creative reasoning (kills characters, ends dynasties, no refusals), multi-persona consistency across hundreds of in-world characters, structured reasoning over JSON state, and reliable JSON tool-call output. Every Hermes call is structured-output enforced; failures are logged and retried with strict-grammar fallback.

### Kimi-K2.6 — long-form prose
**Provider:** Moonshot AI (`https://api.moonshot.ai/v1`)
**Env:** `KIMI_API_KEY`, `KIMI_MODEL=kimi-k2.6`
**Used in:**
- `backend/chroniclon/writer.py` — long-form article generation (1,000–1,500 words per entry) in the voice of the era.

Kimi-K2.6 is chosen for its 256 K context window: the writer sees ~50 prior canon excerpts when drafting any new article, so cross-references, character voices, and faction positions stay coherent across the encyclopedia. Hermes-4 handles the orchestration; Kimi carries the prose.

### FLUX.1-schnell — illustrations
**Provider:** Black Forest Labs via Together AI (`https://api.together.xyz/v1`)
**Env:** `IMAGE_API_KEY`, `IMAGE_MODEL=black-forest-labs/FLUX.1-schnell`
**Used in:**
- `backend/chroniclon/illustrations.py` — per-article illustration generation. Prompts are composed from era art style, scene description, and palette hints.
- `backend/image_gen.py` — cinematic-mode scene generation for the `/watch` route.

### ElevenLabs eleven_multilingual_v2 — narration
**Provider:** ElevenLabs (`https://api.elevenlabs.io`)
**Env:** `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL=eleven_multilingual_v2`
**Used in:**
- `backend/chroniclon/voices.py` — character-voice TTS. Each canon character has a stable voice ID; narration is generated on demand and served from `/api/audio/...`.

The 75-second demo film at `docs/demo.mp4` uses ElevenLabs Antoni (voice ID `ErXwobaYiN019PkySvjV`) for the presenter narration and the same Seraphina voice that the live site uses for the article narration.

---

## How to verify

1. **Read the labels.** Every article on the live site shows its writer (`writer_label: "Hermes-4-70B"` or `"Kimi-K2.6"`) and critic scores in the metadata strip.
2. **Hit the API directly.** `GET https://hermesgenesis.world/api/chronicle/articles/{slug}` returns the full provenance: writer model, critic scores, illustration model, narrator voice ID.
3. **Run it yourself.** `cp .env.example .env`, drop in your own keys, `docker compose up -d`. Spawn a world from `/regen`, watch the canon runner produce articles in `/control`, hear them narrated in `/watch`.

---

## What this project does NOT do

- No model fine-tuning. We do not train, RLHF, or LoRA any of these models. Every call is zero-shot or few-shot at inference.
- No prompt scraping from other systems. Every prompt in `backend/chroniclon/prompts/` is original.
- No content laundering. Every article is generated end-to-end by the pipeline above; no human editing is interleaved.

---

## Licensing

Hermes Genesis is MIT licensed. The constructed-language module, canon-sealing primitive, critic-loop choreography, and editorial frontend are original. All third-party model usage is per each provider's standard terms.
