import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { ColdOpen } from './sequences/ColdOpen';
import { Pipeline } from './sequences/Pipeline';
import { Proof } from './sequences/Proof';
import { Drift } from './sequences/Drift';
import { Close } from './sequences/Close';
import { PaperGrain } from './components/PaperGrain';
import { TIMING, FPS, colors, TOTAL_DURATION } from './lib/tokens';

/**
 * 32-second tight cut. Three audio tracks scheduled in sequence:
 *
 *    0.00 – 18.07s   presenter-1.mp3   (intro through "Listen.")
 *   18.07 – 25.07s   seraphina.mp3     (real article narrated by Sarah)
 *   25.07 – 31.30s   presenter-2.mp3   (drift + URL)
 *   31.30 – 32.00s   tail hold         (URL stays on screen, music fades out)
 *
 * Music bed plays the full 32s, ducks to near-silent during Seraphina.
 * No "still publishing" / "Nine hundred and sixty articles" / "two models" —
 * cut on user feedback. Every word names a visible event.
 */

const PART1_DUR = 18.07;
const SERAPHINA_AT = 18.07;
const SERAPHINA_DUR = 7;
const PART2_AT = SERAPHINA_AT + SERAPHINA_DUR; // 25.07s

const SERAPHINA_START_SEC = 30;

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.paper[50] }}>
      <PaperGrain />

      {/* Music bed */}
      <Audio
        src={staticFile('music.mp3')}
        volume={(f) => {
          const fadeIn = Math.min(1, f / (FPS * 1.5));
          const fadeOut = Math.min(1, (TOTAL_DURATION - f) / (FPS * 1.5));
          const seraphinaStart = SERAPHINA_AT * FPS;
          const seraphinaEnd = (SERAPHINA_AT + SERAPHINA_DUR) * FPS;
          const inSeraphina = f > seraphinaStart - FPS && f < seraphinaEnd + FPS;
          const base = inSeraphina ? 0.04 : 0.10;
          return base * Math.max(0, Math.min(fadeIn, fadeOut));
        }}
      />

      {/* Presenter Part 1 */}
      <Sequence from={0} durationInFrames={Math.round(PART1_DUR * FPS)}>
        <Audio
          src={staticFile('presenter-1.mp3')}
          volume={(f) => {
            const fadeIn = Math.min(1, f / FPS);
            const fadeOut = Math.min(1, (PART1_DUR * FPS - f) / (FPS * 0.4));
            return Math.max(0, Math.min(fadeIn, fadeOut));
          }}
        />
      </Sequence>

      {/* Seraphina */}
      <Sequence from={Math.round(SERAPHINA_AT * FPS)} durationInFrames={SERAPHINA_DUR * FPS}>
        <Audio
          src={staticFile('seraphina.mp3')}
          startFrom={SERAPHINA_START_SEC * FPS}
          endAt={(SERAPHINA_START_SEC + SERAPHINA_DUR) * FPS}
          volume={(f) => {
            const fadeIn = Math.min(1, f / (FPS * 0.4));
            const fadeOut = Math.min(1, (SERAPHINA_DUR * FPS - f) / (FPS * 0.4));
            return 0.95 * Math.max(0, Math.min(fadeIn, fadeOut));
          }}
        />
      </Sequence>

      {/* Presenter Part 2 */}
      <Sequence from={Math.round(PART2_AT * FPS)} durationInFrames={TOTAL_DURATION - Math.round(PART2_AT * FPS)}>
        <Audio
          src={staticFile('presenter-2.mp3')}
          volume={(f) => {
            const fadeIn = Math.min(1, f / (FPS * 0.4));
            const fadeOut = Math.min(1, (TOTAL_DURATION - Math.round(PART2_AT * FPS) - f) / (FPS * 0.6));
            return Math.max(0, Math.min(fadeIn, fadeOut));
          }}
        />
      </Sequence>

      {/* Visual sequences */}
      <Sequence from={TIMING.coldOpen.from} durationInFrames={TIMING.coldOpen.duration}>
        <ColdOpen />
      </Sequence>

      <Sequence from={TIMING.pipeline.from} durationInFrames={TIMING.pipeline.duration}>
        <Pipeline />
      </Sequence>

      <Sequence from={TIMING.proof.from} durationInFrames={TIMING.proof.duration}>
        <Proof />
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
