# Hermes Genesis · Remotion demo film

Editorial 90-second demo film for [Chroniclon](https://hermesgenesis.world). Composed as React, rendered to mp4 via headless Chrome.

## Render

Prereq: Node 18+. Chromium is auto-downloaded by Remotion on first render.

```bash
cd remotion
npm install
npm run render        # writes demo.mp4 in this directory (~10–25 min on a laptop)
```

Open `demo.mp4` when it's done. That's the deliverable.

## Preview while editing

```bash
npm run studio        # http://localhost:3000 — scrub the timeline, hot-reload
```

## Generate a still

For Twitter / OG cards:

```bash
npm run still         # frame 240 → poster.png
```

## Composition

90 seconds @ 30fps · 1920×1080 · h264 · yuv420p · CRF 18

| Time | Frames | Sequence | What happens |
|---|---|---|---|
| 0–8s | 0–240 | **Cold Open** | "A wikipedia for a world that doesn't exist." Display headline word-by-word, last word italic gilt. |
| 8–22s | 240–660 | **Seed** | Cursor types one-sentence world prompt. Three stages animate in. Metric band springs up: 3 regions · 5 factions · 12 characters · 7 days. |
| 22–38s | 660–1140 | **Pipeline** | Three cards stagger in: Hermes-4-70B picks the event · Kimi-K2.6 typewrites three lines of prose · critic stamps land at 0.92 / 0.88. |
| 38–68s | 1140–2040 | **Proof** | The actual *Seraphina's Final Entry* article reveals: real illustration zoom, drop cap on the first paragraph, ElevenLabs narration plays for 30 seconds. |
| 68–82s | 2040–2460 | **Drift** | Phonological rule appears (/k/ → /tʃ/ between vowels), then three lexicon entries morph through three eras with gilt arrows. |
| 82–90s | 2460–2700 | **Close** | Stats count up (960 articles · 4 eras · 1 sentence in), wordmark, URL with live-dot, "still publishing." |

## Assets

- `public/seraphina.mp3` — ElevenLabs narration of *The Inkwell-Parchmentshield Betrayal*. Refresh by re-running:
  ```bash
  curl -fsSL https://hermesgenesis.world/api/chronicle/audio/the-inkwell-parchmentshield-betrayal-seraphinas-final-entry -o public/seraphina.mp3
  ```
- `public/seraphina.webp` — illustration for the same article. Refresh similarly:
  ```bash
  curl -fsSL https://hermesgenesis.world/api/chronicle/images/the-inkwell-parchmentshield-betrayal-seraphinas-final-entry -o public/seraphina.webp
  ```

## Editorial discipline

The video is not screen-recorded. Every frame is a React render. This means:

- Same Source Serif 4 / Geist / JetBrains Mono as the site
- Same gilt/ink/vellum palette (mirrored in `src/lib/tokens.ts`)
- Same paper-grain atmosphere via the `<PaperGrain>` component
- Same critic scores, drop cap, eyebrow kicker, freshness pulse

If the site evolves, update `src/lib/tokens.ts` and the corresponding components to match.

## Cuts to add later (optional)

Register additional compositions in `src/Root.tsx`:

```tsx
<Composition id="X-clip" component={Demo} durationInFrames={30 * FPS} ... />     // 30s for X
<Composition id="Vertical" component={Demo} width={1080} height={1920} ... />    // 9:16 mobile
```

Then `npm run render -- --composition=X-clip` etc.

## License

Remotion is free for individuals and teams under 4 people / under $10M revenue. See <https://remotion.dev/license>.
