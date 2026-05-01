# Chroniclon — Demo Video Script

**Target length**: 60-75 seconds (sweet spot for X video plays).
**Format**: screen-recorded, voiceover, minimal text overlays.
**Final card**: "Built on Hermes Agent + Kimi. The canon keeps writing."

Record after the autonomous run has produced ~80+ articles (waits ~12-18h
from start) so the wiki list shows depth and an era transition has fired.

---

## Scene 1 — Hook (0:00–0:05)

**Visual**: Black screen. Single sentence types onto screen one character at
a time, slow:
> *A world where the moon is sentient and writes letters to the queen.*

Then below it, smaller, fades in:
> *On April 28, I gave that sentence to an AI.*

**VO**: "On April 28, I gave an AI a single sentence."

---

## Scene 2 — Reveal (0:05–0:15)

**Visual**: Hard cut to the live wiki at `/chronicle`. The stats banner is
front and center. Article count, total words, era count, contributors —
all real numbers.

**VO**: "This is the Wikipedia for that world. It is being written
autonomously, right now, by a Hermes Agent paired with Kimi."

**Text overlay** (bottom): article count + word count, e.g. *"83 articles ·
51,402 words · 4 eras"* — pulled from `/api/chronicle/stats` at record time.

---

## Scene 3 — The Canon (0:15–0:35)

**Visual**: Scroll the article list slowly. Hover over titles. Each article
shows kind + voice badge + year. Sample titles to feature on screen:
- *The Betrayal of Silas Stargaze* (event, scholarly, year 1)
- *The Fulfillment of the Lunar Scrivener's Prophecy* (prophecy, year 3)
- *The Cinder Codex* (artifact, scripture, year 12) — only if era 2+ exists
- *Queen Aelis the Younger* (person, court, year 8) — only if rendered

Click into one article. Show the markdown body rendering — headers,
in-world citations, `[[cross-links]]` to other articles. Click a cross-link.
The next article opens. Click another. The world keeps connecting.

**VO**: "Every event in the simulation gets debated by an agent — does it
matter? what voice should it speak in? — and then Kimi writes it as a wiki
entry. Every article cross-links to others. The civilization cites itself."

---

## Scene 4 — Eras + Languages (0:35–0:50)

**Visual**: Click "Languages" tab on the Chronicle page. The D3 family tree
of linguistic eras shows. Click a node — lexicon panel slides in showing
phonology notes + sample lexicon entries (e.g. `moon: vael`, `queen:
aelin`). Sample text below.

**VO**: "The world's language drifts across eras. The agent maintains the
phonology and a core lexicon as the civilization ages — millennia compressed
into the run."

---

## Scene 5 — Live regen (0:50–1:05)

**Visual**: Navigate to `/regen`. Type a fresh seed:
> *"An island that remembers everything anyone has ever done on it."*

Press regenerate. Speed up the SSE stream in editing if needed. Show:
- world_ready event with regions/factions/characters
- linguistic_drift event with new lexicon
- article_canonized events appearing one after another
- Final state: a brand-new starter wiki

**VO**: "It's not one fictional world. Hand it any seed and another
civilization is born — wiki and all — in under a minute."

---

## Scene 6 — Close (1:05–1:15)

**Visual**: Cut back to the main wiki. Stats banner on screen. Then black.
Final cards in sequence:
1. *"Hermes-4-70B + Moonshot Kimi"*
2. *"Live: hermesgenesis.world/chronicle"* (or final URL)
3. *"@NousResearch · @Kimi_Moonshot"*
4. *"The canon keeps writing."*

**VO**: "Hermes Agent and Kimi, building a civilization that doesn't stop.
Tagging @NousResearch and @Kimi_Moonshot — the canon keeps writing."

---

## Recording checklist

Before pressing record:

- [ ] Run has 80+ articles in canon (`curl /api/chronicle/stats`)
- [ ] At least 1 era transition has fired (`era_count >= 2`)
- [ ] At least 1 linguistic era exists (`linguistic_eras >= 1`)
- [ ] Wiki page has been hard-refreshed so latest articles appear
- [ ] Browser at clean window, no extensions, no DevTools
- [ ] Display at 1920×1080, browser zoom 100%
- [ ] OBS recording at 1920×1080, 60fps preferred
- [ ] Single audio track for VO; mute system sounds
- [ ] Test the regen flow with a throwaway seed first to confirm timing

After recording:

- [ ] Cut to 60-75 seconds
- [ ] Add subtle music bed (instrumental, low — Pond5 or similar; no copyright issues)
- [ ] Color grade: cool blues, warm amber accents (matches the wiki theme)
- [ ] Export 1080p mp4, under 25MB for X upload
- [ ] Upload as draft, do NOT post until user explicitly approves
