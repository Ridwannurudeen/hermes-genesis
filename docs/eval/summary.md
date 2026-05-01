# Long-form coherence — Chroniclon canon eval

_Generated_: 2026-04-30T01:08:46.469234Z
_Articles measured_: 65

## Methodology

All metrics are deterministic textual measurements — no LLM-as-judge,
no human grading. The grant question is whether long-form coherence
differs across writers (Hermes-4-70B vs Kimi-K2.6) on the same
agentic pipeline.

| Metric | What it measures |
|---|---|
| fourth_wall_break_rate | fraction of articles mentioning AI/simulation/etc. |
| crosslink_density_per_100w | `[[slug]]` references per 100 words |
| voice_register_match_rate | regex match against the declared voice (court/scripture/diary/newspaper/scholarly) |
| lexicon_adherence | fraction of the era's sample lexicon that appears in the body |
| unique_token_ratio | unique 3+ char alpha tokens / total. Repetition canary. |
| word_count_mean | actual prose length |

## Results

### kimi

- **n_articles**: `65`
- **fourth_wall_break_rate**: `0.077`
- **fourth_wall_breaks_per_article**: `0.138`
- **crosslink_density_per_100w**: `0.439`
- **voice_register_match_rate**: `0.569`
- **lexicon_adherence_mean**: `0.123`
- **unique_token_ratio_mean**: `0.536`
- **word_count_mean**: `513.0`
- **anti_slop_mean**: `0.584`
- **fact_check_mean**: `0.548`
- **voice_distribution**: `{'diary': 4, 'newspaper': 19, 'scholarly': 38, 'court': 4}`
