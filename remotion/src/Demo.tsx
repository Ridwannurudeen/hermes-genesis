import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { ColdOpen } from './sequences/ColdOpen';
import { Seed } from './sequences/Seed';
import { Pipeline } from './sequences/Pipeline';
import { Proof } from './sequences/Proof';
import { Drift } from './sequences/Drift';
import { Close } from './sequences/Close';
import { PaperGrain } from './components/PaperGrain';
import { TIMING, FPS, colors } from './lib/tokens';

/**
 * 90-second editorial demo film for Hermes Genesis / Chroniclon.
 *
 * Structure (frames at 30fps):
 *   0–240    Cold open       — title card, ink fade-in
 *   240–660  Seed            — one sentence in, world spawning
 *   660–1140 Pipeline        — Hermes / Kimi / critics
 *   1140–2040 Proof          — real article + ElevenLabs narration
 *   2040–2460 Drift          — phonological + lexicon drift
 *   2460–2700 Close          — URL, stats, "still publishing"
 *
 * The audio bed is the ElevenLabs Seraphina narration. We trim a 30-second
 * window (start ~30s into the file, where the prose has settled) and play
 * it during the Proof sequence. Other sequences are silent — the editorial
 * register doesn't need a music bed.
 */

const PROOF_AUDIO_START_SEC = 30; // jump past the article's title intro
const PROOF_AUDIO_DURATION_SEC = 30;

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.paper[50] }}>
      {/* Atmospheric paper-grain pattern, persistent under all sequences. */}
      <PaperGrain />

      <Sequence from={TIMING.coldOpen.from} durationInFrames={TIMING.coldOpen.duration}>
        <ColdOpen />
      </Sequence>

      <Sequence from={TIMING.seed.from} durationInFrames={TIMING.seed.duration}>
        <Seed />
      </Sequence>

      <Sequence from={TIMING.pipeline.from} durationInFrames={TIMING.pipeline.duration}>
        <Pipeline />
      </Sequence>

      <Sequence from={TIMING.proof.from} durationInFrames={TIMING.proof.duration}>
        <Proof />
      </Sequence>

      {/* Audio bed — only during the Proof sequence. */}
      <Sequence from={TIMING.proof.from} durationInFrames={PROOF_AUDIO_DURATION_SEC * FPS}>
        <Audio
          src={staticFile('seraphina.mp3')}
          startFrom={PROOF_AUDIO_START_SEC * FPS}
          endAt={(PROOF_AUDIO_START_SEC + PROOF_AUDIO_DURATION_SEC) * FPS}
          volume={(f) => {
            // 1s fade-in, 1.5s fade-out so the cut to Drift breathes.
            const fadeIn = Math.min(1, f / FPS);
            const total = PROOF_AUDIO_DURATION_SEC * FPS;
            const fadeOut = Math.min(1, (total - f) / (1.5 * FPS));
            return Math.max(0, Math.min(fadeIn, fadeOut));
          }}
        />
      </Sequence>

      <Sequence from={TIMING.drift.from} durationInFrames={TIMING.drift.duration}>
        <Drift />
      </Sequence>

      <Sequence from={TIMING.close.from} durationInFrames={TIMING.close.duration}>
        <Close />
      </Sequence>
    </AbsoluteFill>
  );
};
