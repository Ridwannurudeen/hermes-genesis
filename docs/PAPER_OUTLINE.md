# Hermes Genesis — workshop paper outline

Target venues (in order of fit):

1. **NeurIPS 2026 Creative AI Workshop** — most natural fit; runs annually with a "creative use of generative models" remit. Last year's program had several long-running-narrative + worldbuilding submissions.
2. **ICLR 2026 Generative Agents Track** — Park et al's lineage; reviewers will already know the comparison set.
3. **EMNLP 2026 Narrative Understanding & Generation** — strong fit if we lead with the conlang module, weaker if we lead with the agent loop.
4. **CHI Late-Breaking Work** — if we want HCI framing, "interactive worldbuilding companion."

Working title (pick one):

- **"Hermes Genesis: Autonomous Publishing of Fictional Canon with Cross-Temporal Coherence and Linguistic Drift"** ← descriptive
- **"A Wikipedia for a World That Doesn't Exist: Multi-Agent Coherent Long-Form Fiction at Scale"** ← lyrical
- **"The Canon Loop: Multi-Agent Critic Pipelines for Sustained Fictional World-Building"** ← system-paper register

I'd lead with the descriptive title for venue 1, lyrical for venue 4.

---

## Abstract (~150 words)

```
Existing work on AI agents and creative writing has produced two
disconnected paradigms: simulation-only systems (Park et al. 2023's
Smallville) where agents act but never publish, and one-shot generation
systems (AI Dungeon, single-prompt LLM writing) that produce isolated
artifacts without persistence. We present Hermes Genesis, an autonomous
fiction engine that bridges them: a multi-agent pipeline that turns a
single seed sentence into a self-publishing fictional Wikipedia, indef-
initely. Three Hermes-4-70B agents (canon decision + two critics) and
one Kimi-K2.6 long-form writer collaborate to canonize, draft, score,
and revise articles about a simulated civilization. A constructed-
language module produces phonological rules and lexicon morphology that
drift across in-world eras. We report on 960 published articles across
four eras, demonstrate cross-temporal coherence via cross-linking and
provenance traces, and quantify the quality contribution of the critic
loop. Live system: hermesgenesis.world.
```

> 158 words. Cuts in: 950–1100 chars. Camera-ready abstracts run 150–250.

---

## 1. Introduction (~600 words)

**Beats:**

1. **The gap.** Open with what's missing in the literature — "simulation without publishing, generation without persistence" — and motivate why a *publishing-layer* artifact is interesting beyond either.
2. **The artifact.** Brief description: Hermes Genesis publishes Chroniclon, a 960-article fictional encyclopedia, autonomously, with linguistic drift across in-world eras. The civilization keeps publishing whether anyone is watching.
3. **Contributions.** Bullet:
   - A 4-agent / 2-model autonomous publishing pipeline with anti-slop and fact-check critics in the publishing path
   - A constructed-language module that produces real phonological evolution (not just vocabulary substitution)
   - An evaluation regime focused on *cross-temporal coherence* (do articles stay consistent over centuries of in-world time?) which the closest prior work does not address
   - An open-source running deployment with persistent canon state, available for inspection and reproduction

**Hook quote candidate** (for opening): *"A wikipedia for a world that doesn't exist."*

---

## 2. Related Work (~700 words)

**Three threads to weave:**

### 2.1 Generative agents and emergent narrative

- **Park et al. 2023, "Generative Agents"** (Smallville) — 25 agents in a Sims-like town, memory streams, reflection. Simulation only. No publishing artifact.
- **AI Town** (a16z / Convex / Karpathy demo, 2023) — open-source production of Smallville. Same paradigm, more polished UI. ~12k+ GitHub stars. No publishing layer.
- **Wang et al. 2024 ("Voyager")** — agents that build skills in Minecraft. Agency without narrative artifact.

Position: Hermes Genesis is the publishing layer that this thread missed.

### 2.2 LLM-driven creative writing

- **AI Dungeon (Latitude)** — interactive choose-your-own-adventure. Single-player. No shared canon.
- **NovelAI, Sudowrite, Novelcrafter** — assisted fiction tools for human authors. Not autonomous.
- **Hidden Door** — multi-player narrative startup, IP-licensed. Humans drive scenes. Not autonomous.
- **GPT-NeoX-based "Author bots"** in Discord communities — one-shot generators, no persistence.

Position: prior work treats LLM writing as a turn-taking utility. Hermes Genesis treats it as a publishing role inside a longer agent loop.

### 2.3 Conlang generation and computational phonology

- **Hartman & Hudson 2007**, *Computational approaches to constructed languages* — feasibility of phonological rule application by program.
- **Bouchard-Côté et al. 2013** — automated reconstruction of proto-languages.
- **DraftLang / WAGGLE** — utilities that apply sound-change rules to wordlists.

Position: existing work either (a) reconstructs real languages from cognates or (b) applies user-specified rules to user-specified wordlists. Hermes Genesis *generates* the rules, the lexicon, AND the inscriptions in-world, anchored to era transitions in a simulated civilization.

### 2.4 Autonomous content publishing

- **AutoGPT / BabyAGI** lineage — task agents that self-decompose. Limited persistence, no publishing-quality output.
- **Agent-LLM frameworks** (LangChain agents, LangGraph) — infrastructure, not artifacts.

Position: we present an artifact, not a framework.

---

## 3. System Architecture (~1,000 words)

**Figure 1**: pipeline diagram. 6 boxes: World simulation → Canon agent (Hermes-4) → Article writer (Kimi-K2.6) → Anti-slop critic (Hermes-4) → Fact-check critic (Hermes-4) → Cross-linker → Storage. Loops back to World simulation via "canonized event" feedback.

### 3.1 World simulation layer

- Geography, factions, characters with persistent genomes (6-trait vector: courage, cunning, loyalty, ambition, empathy, resilience)
- Day-by-day event simulation (military, alliance, betrayal, succession, divine intervention, prophecy fulfillment, etc.)
- Auto-simulation: when the event queue empties, the simulator generates new events without user input. **This is the key autonomy property.**

### 3.2 Canon decision (Hermes-4-70B)

- Reads the event + recent canonized titles + open prophecies
- Returns: canonize? + kind/voice/length + cross-link suggestions
- Skip-rate is intentional: ~40% of events are deemed not-article-worthy
- Anti-redundancy guard at write time (Jaccard ≥ 0.7 over normalized title tokens)

### 3.3 Long-form writer (Kimi-K2.6)

- Why Kimi over Hermes for prose: 256K context window matters when feeding the agent ~50 prior canon excerpts for stylistic consistency
- Voice register selection from {scholarly, diary, newspaper, scripture, court, lunar-epistle}
- Era-aware prompt injection: lexicon samples + phonology notes from the in-world year

### 3.4 Critic loop (anti-slop + fact-check)

- **Anti-slop critic**: scores 0–1 against six failure modes (purple prose, fourth-wall break, AI tells, unsupported assertion, voice drift, length padding)
- **Fact-check critic**: cross-references claims against the existing canon. Returns contradictions list + score.
- Revision protocol: if either score < 0.6, one revision pass with critic notes injected. If still failing, drop quietly (publish floor 0.55).

### 3.5 Cross-linking + provenance

- After publish-pass, propose `[[wiki-style-links]]` to existing canon
- Bidirectional inbound list maintained
- Provenance trace: `source_event_id` and `source_world_id` recorded so any article can be traced back to the simulation event that birthed it ("autopsy" view)

### 3.6 Constructed-language module

This is the section that earns the workshop slot.

- Era transitions trigger linguistic shifts: phonological rules (e.g., /k/ → /tʃ/ between vowels), morphology mutations (plural marker change, honorific drift), lexicon turnover
- Rules are LLM-proposed, then applied programmatically to era-N lexicon to derive era-N+1 lexicon
- Sample texts and inscriptions in each era's tongue, with translations
- Phonology notes and sound-shift contexts surfaced in the published articles for that era

### 3.7 Multimedia

- FLUX illustrations per article (auto-render hook on canon publish)
- ElevenLabs TTS narration with character-genome-mapped voice archetypes (5 voices: narrator, warrior, schemer, scholar, mystic)
- Cinematic mode: full-screen scene playback with mood-themed gradients, scene images, voice narration, ambient sound

---

## 4. Evaluation (~1,000 words)

**Figure 2**: a sample article-detail view + provenance trail.
**Figure 3**: linguistic drift table across 4 eras.
**Figure 4**: critic score distribution before/after revision.

### 4.1 Coherence over time

- N = 960 articles, 4 in-world eras, ~160 in-world years
- **Cross-link density**: average inbound links per article (target: > 2.0)
- **Character persistence**: % of articles whose lead character appears in ≥ 3 prior articles
- **Faction consistency**: contradiction rate as evaluated by independent Hermes-4 audit pass over a held-out sample

### 4.2 Linguistic drift quality

- Solicit phonologist/conlanger review (informal, ~3 reviewers from r/conlangs or via direct email)
- Plausibility rubric: rule realism, lexicon-rule consistency, inscription naturalness
- Quantitative: Levenshtein distance between era-N and era-N+1 cognate forms (target: drift but not chaos)

### 4.3 Critic loop effectiveness

- Ablation: same prompts, no critic loop, N = 200 articles
- Metric: human pairwise preference on output (with vs without critics)
- Plus: cost-per-article comparison (with vs without revision pass)

### 4.4 Compute economics

- Real numbers from production logs: tokens consumed per published article, USD cost
- Break down by stage (decision, writing, critique, revision, illustration, narration)
- This is a section the field largely ignores. Ours will be cited.

### 4.5 Limitations

- Same 5–6 characters dominate the canon (storyline collapse over time)
- Audio coverage at 9.4% (TTS rate-limited)
- 255 historical duplicate-slug articles archived (not deleted) — a reproducibility caveat
- No human-in-the-loop course correction mid-run
- No multilingual evaluation outside English

---

## 5. Discussion (~500 words)

- **Why publishing is the right primitive.** Compared to "simulation" (Park et al) and "generation" (AI Dungeon), publishing forces persistence + criticism + cross-reference, three things missing in both.
- **What this implies for agent design.** A canon agent that says *no* (skip-rate ~40%) is more valuable than one that produces every event into prose. Selectivity is the editorial signature.
- **Conlang as differentiator.** No prior generative-agent system has tackled phonological evolution. Open question: does the LLM's rule generation match human conlanger intuitions? Workshop reviewers care about this.
- **Compute regime.** ~$0.30 per published article at production cost (provisional). At what point does this become economic vs. human authorship? (Open question, not answered in the paper.)

---

## 6. Conclusion (~150 words)

Restate the thesis. Re-cite the live URL. Invite reproduction.

---

## References (~30 cites)

Plan to cite:

- Park et al. 2023 (Generative Agents, Smallville)
- Wang et al. 2024 (Voyager)
- Bouchard-Côté et al. 2013 (proto-language reconstruction)
- AI Town (citing GitHub repo)
- Stiennon et al. 2020 (RLHF for summarization, for the critic-loop framing)
- Yao et al. 2023 (ReAct, for the agent-loop architecture)
- Madaan et al. 2023 (Self-Refine, for the revision critic)
- Standard NLP cites for evaluation methodology
- Conlang literature (Peterson 2015, Adger 2019)

---

## Open questions before drafting

1. **Single-author or co-author?** If solo, the "I built it" voice carries. If co-author (Codex contributions count as collaboration?), shifts to "we."
2. **Anonymous submission for double-blind?** Most workshops require it. The live URL needs to be pseudonymized in the paper version.
3. **Reproducibility package?** Most workshops want a repo. We have one. Make sure README has a "reproduce the paper claims" section before submission.
4. **License for the data corpus?** The 960 generated articles should be CC0 or similar so reviewers can use them for analysis.
5. **Eval harness — manual or automated?** The "coherence over time" metric needs a script or the paper will be hand-wavy. Stub `scripts/coherence_eval.py` exists; needs to actually run.

---

## Suggested timeline

| Week | Action |
|---|---|
| Week 0 (now) | This outline. Pick title + venue. |
| Week 1 | Write Sections 1–3 (intro, related work, system). Build figures 1–2. |
| Week 2 | Run real evaluations (Section 4). Draft results. |
| Week 3 | Discussion + conclusion. Format to venue's LaTeX template. |
| Week 4 | Internal review. Anonymize. Submit. |

NeurIPS 2026 workshops typically have September deadlines. ICLR Generative Agents calls often open in October. EMNLP narrative-NLP varies.

---

## What to do next

1. **Confirm target venue.** I'd default to NeurIPS Creative AI 2026.
2. **Pick title.** I'd pick the lyrical one (`A Wikipedia for a World That Doesn't Exist`) for the venue — Creative AI loves a quotable title.
3. **Decide single vs co-author.** Affects voice throughout.
4. **Tell me to start drafting Section 1.** I'll write it as full prose against this skeleton, in the same first-person voice as the X thread but academic-register.
