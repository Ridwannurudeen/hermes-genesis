import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { colors, fonts } from '../lib/tokens';

/**
 * Problem — 15 seconds (frames 0–450 within sequence).
 *
 * Narration over this sequence:
 *   "Stanford's generative agents simulate people walking around a town.
 *    AI Dungeon writes choose-your-own-adventure. Nobody had built a system
 *    that publishes its own coherent canon — articles that cite each other,
 *    characters who persist, language that drifts across centuries. So I did."
 *
 * Visual: comparison table. Left column is the prior art (Smallville,
 * AI Dungeon). Right column is what's missing — and our claim to fill it.
 */

const COMPARISONS = [
  {
    label: "Stanford's Smallville",
    bullet: 'agents walk around a town',
    has: 'simulation',
    missing: 'no publishing layer',
  },
  {
    label: 'AI Dungeon',
    bullet: 'choose-your-own-adventure',
    has: 'narrative',
    missing: 'no shared canon',
  },
  {
    label: 'Hidden Door',
    bullet: 'multi-player, IP-licensed',
    has: 'distribution',
    missing: 'humans drive scenes',
  },
];

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();

  const eyebrowOp = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp' });
  const headlineOp = interpolate(frame, [10, 50], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const headlineY = interpolate(frame, [10, 50], [10, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Comparisons stagger in starting at 1.8s
  const COMP_START = 54;
  const COMP_STEP = 26;

  // Final claim slides in at the end
  const claimStart = 54 + COMPARISONS.length * COMP_STEP + 18;
  const claimOp = interpolate(frame, [claimStart, claimStart + 30], [0, 1], { extrapolateRight: 'clamp' });
  const claimY = interpolate(frame, [claimStart, claimStart + 30], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1640, padding: '0 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: eyebrowOp }}>
          <GiltRule width={56} startFrame={0} duration={18} />
          <Eyebrow>chapter one · the gap</Eyebrow>
        </div>

        <h2
          style={{
            fontFamily: fonts.display,
            fontSize: 68,
            fontWeight: 600,
            color: colors.ink[900],
            letterSpacing: '-0.025em',
            lineHeight: 1.06,
            marginTop: 24,
            opacity: headlineOp,
            transform: `translateY(${headlineY}px)`,
            maxWidth: 1340,
          }}
        >
          Nobody had published a fictional civilization's <span style={{ fontStyle: 'italic', color: colors.gilt[500] }}>canon</span>.
        </h2>

        {/* Comparison rows */}
        <div style={{ marginTop: 44 }}>
          {COMPARISONS.map((c, i) => {
            const start = COMP_START + i * COMP_STEP;
            const op = interpolate(frame, [start, start + 22], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            const y = interpolate(op, [0, 1], [10, 0]);
            return (
              <div
                key={c.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '300px 1fr 1fr',
                  alignItems: 'baseline',
                  padding: '16px 0',
                  borderBottom: i < COMPARISONS.length - 1 ? `1px solid ${colors.ink[900]}14` : 'none',
                  opacity: op,
                  transform: `translateY(${y}px)`,
                  gap: 24,
                }}
              >
                <div
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 26,
                    fontWeight: 600,
                    color: colors.ink[900],
                    letterSpacing: '-0.01em',
                  }}
                >
                  {c.label}
                </div>
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 19,
                    color: colors.ink[700],
                    fontStyle: 'italic',
                  }}
                >
                  {c.bullet}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.18em',
                      color: colors.moss[500],
                      border: `1px solid ${colors.moss[500]}66`,
                      padding: '4px 10px',
                      borderRadius: 4,
                    }}
                  >
                    {c.has}
                  </span>
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.18em',
                      color: colors.crimson[500],
                      border: `1px solid ${colors.crimson[500]}66`,
                      padding: '4px 10px',
                      borderRadius: 4,
                    }}
                  >
                    {c.missing}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Claim line — "So I did." */}
        <div
          style={{
            marginTop: 36,
            opacity: claimOp,
            transform: `translateY(${claimY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 30,
              fontStyle: 'italic',
              color: colors.gilt[500],
              letterSpacing: '-0.01em',
            }}
          >
            So I did.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
