import { AbsoluteFill, interpolate, useCurrentFrame, Easing, spring, useVideoConfig } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { colors, fonts } from '../lib/tokens';

/**
 * Pipeline — 16 seconds. The agent stack as choreography.
 *
 *   0–2     Section title
 *   2–6     Card 1 reveals — Hermes-4-70B picks: "this is article-worthy"
 *   6–10    Card 2 reveals — Kimi-K2.6 writes: typewriter outputs 3 lines
 *  10–14    Card 3 reveals — critic stamps land: 0.92 / 0.88
 *  14–16    Connector lines complete; held composition
 */

const TYPED_LINES = [
  'Of all the houses, none could have foreseen what the moon’s sealed letter would inscribe—',
  'Seraphina’s last entry, set down in trembling ink at the border of two ages.',
  'The silence in the courtyard, even the harpsichord, refused to keep time.',
];

export const Pipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card reveal timings (in seconds within the Pipeline sequence). Pipeline
  // starts at video 5s; the narration timeline within Part 1 is:
  //   video 6s    "Hermes-4 decides…"        → card 1 lights at Pipeline+1s
  //   video 9.5s  "Kimi K2.6 writes…"        → card 2 lights at Pipeline+4.5s
  //   video 12s   "Hermes critics score…"    → card 3 lights at Pipeline+7s
  //   video 14s   "Pass — the canon seals."  → critic stamps visible (in card 3)
  const cards = [
    { startSec: 1, label: 'Hermes-4-70B', stage: 'canon decision' },
    { startSec: 4.5, label: 'Kimi-K2.6', stage: 'long-form prose' },
    { startSec: 7, label: 'Hermes-4-70B', stage: 'anti-slop · fact-check' },
  ];

  const titleOpacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1640, padding: '0 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: titleOpacity }}>
          <GiltRule width={56} startFrame={0} duration={18} />
          <Eyebrow>chapter two · the pipeline</Eyebrow>
        </div>

        <div
          style={{
            marginTop: 32,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 0,
            border: `1px solid ${colors.ink[900]}1A`,
            backgroundColor: colors.ink[900] + '08',
          }}
        >
          {cards.map((c, i) => {
            const start = c.startSec * fps;
            const f = frame - start;
            const op = f <= 0 ? 0 : spring({ frame: f, fps, config: { damping: 16, stiffness: 90 } });
            const y = interpolate(op, [0, 1], [16, 0]);
            return (
              <div
                key={`card-${i}`}
                style={{
                  backgroundColor: colors.paper[50],
                  padding: '32px 36px',
                  minHeight: 360,
                  opacity: op,
                  transform: `translateY(${y}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    color: colors.ink[500],
                  }}
                >
                  step {['one', 'two', 'three'][i]}
                </div>
                <div
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 30,
                    fontWeight: 600,
                    color: colors.ink[900],
                    letterSpacing: '-0.012em',
                    marginTop: 6,
                  }}
                >
                  {c.stage}
                </div>
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 16,
                    color: colors.gilt[500],
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {c.label}
                </div>

                {/* Per-card content reveals once the card has settled. */}
                {i === 0 && <CanonDecision startFrame={start + 28} />}
                {i === 1 && <KimiTypewriter startFrame={start + 28} />}
                {i === 2 && <CriticStamps startFrame={start + 28} />}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CanonDecision: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - startFrame, [0, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ marginTop: 32, opacity: op }}>
      <div style={{ fontFamily: fonts.body, fontSize: 19, lineHeight: 1.55, color: colors.ink[700] }}>
        Event #4188 — <span style={{ color: colors.ink[900] }}>The Inkwell-Parchmentshield Betrayal</span>
      </div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: colors.moss[500],
            border: `1px solid ${colors.moss[500]}66`,
            padding: '4px 10px',
            borderRadius: 4,
          }}
        >
          ✦ canonize
        </span>
        <span style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.ink[500] }}>
          kind: event · voice: diary · words: 1,200
        </span>
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: fonts.body,
          fontSize: 17,
          fontStyle: 'italic',
          color: colors.ink[500],
          lineHeight: 1.5,
        }}
      >
        "This is article-worthy: a betrayal at the threshold of the Cinder Era, written in
        the dying voice of its principal."
      </div>
    </div>
  );
};

const KimiTypewriter: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ marginTop: 32 }}>
      {TYPED_LINES.map((line, idx) => {
        const lineStart = startFrame + idx * 32;
        const local = frame - lineStart;
        const charsPerFrame = line.length / 30;
        const charsShown = Math.max(0, Math.min(line.length, Math.floor(local * charsPerFrame)));
        return (
          <div
            key={idx}
            style={{
              fontFamily: fonts.body,
              fontSize: 18,
              lineHeight: 1.55,
              color: colors.ink[700],
              marginBottom: 12,
              minHeight: 28,
            }}
          >
            {line.slice(0, charsShown)}
          </div>
        );
      })}
    </div>
  );
};

const CriticStamps: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slop = (frame - startFrame) >= 0 ? spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 120 } }) : 0;
  const fact = (frame - startFrame - 18) >= 0 ? spring({ frame: frame - startFrame - 18, fps, config: { damping: 14, stiffness: 120 } }) : 0;

  return (
    <div style={{ marginTop: 32 }}>
      <Stamp label="anti-slop" value="0.92" appear={slop} />
      <div style={{ height: 16 }} />
      <Stamp label="fact-check" value="0.88" appear={fact} />
      <div
        style={{
          marginTop: 28,
          fontFamily: fonts.body,
          fontSize: 17,
          fontStyle: 'italic',
          color: colors.ink[500],
          opacity: Math.min(slop, fact),
        }}
      >
        Both critics passed. Article sealed into the canon.
      </div>
    </div>
  );
};

const Stamp: React.FC<{ label: string; value: string; appear: number }> = ({ label, value, appear }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        opacity: appear,
        transform: `translateX(${(1 - appear) * 12}px)`,
      }}
    >
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: colors.ink[500],
          width: 110,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 36,
          fontWeight: 600,
          color: colors.moss[500],
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
};
