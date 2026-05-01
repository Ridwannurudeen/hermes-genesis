# Chroniclon

The autonomous civilizational canon engine layered on top of Hermes Genesis.

## Module map (target)

```
chroniclon/
  __init__.py
  models.py            # Era, WikiArticle, LinguisticEra, CanonSubmission
  store.py             # JSON persistence for articles + eras + lexicon
  era.py               # era ticker, time compression, era-boundary triggers
  article_writer.py    # Kimi K2.6 long-form article generation
  critics.py           # fact-check, anti-slop, cross-link, moderation critics
  language.py          # linguistic drift maintainer (Kimi 256K context)
  canon_agent.py       # decides what events become articles, what voice to use
  audience.py          # public submission queue + moderation pipeline
  voices.py            # genome → TTS voice profile mapping
  routes.py            # FastAPI routes (/api/chronicle/*)
  run.py               # entry point for the 144-hour autonomous run
```

## Build order (Day 0 → Day 6)

- Day 0: scaffold (this commit), dual LLM client (`backend/llm.py`)
- Day 1: `article_writer.py`, `critics.py`, `store.py`, frontend `/chronicle` skeleton
- Day 2: `era.py`, `language.py`, `audience.py`
- Day 3: Moon X presence (separate `chroniclon/moon/` runtime)
- Day 4: family tree + language tree D3 viz, audio chapter render via `voices.py`
- Day 5: live regen mode, demo video
- Day 6: polish + skill packaging

## Why dual provider

Kimi K2.6's 256K context lets us hold the entire evolving lexicon + canonical
character voices + plot threads in one prompt. Hermes-4-70B is faster and
better at structured agent decisions and adversarial critic loops.

Routing rule:
- **Kimi**: long-form article body (~2k–8k words), language drift, screenplay-style passages
- **Hermes**: agent decisions (canonize? approve? what voice?), critic loops, JSON-structured outputs

`backend/llm.py:chat_completion(provider="kimi"|"nous", ...)` selects.
