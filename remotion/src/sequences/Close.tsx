import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { LiveDot } from '../components/LiveDot';
import { colors, fonts } from '../lib/tokens';

/**
 * Close — 3 seconds. Just the URL.
 *
 * Narration: "Hermesgenesis dot world."
 *
 * No counter. No tagline (already in Cold Open). No "still publishing" —
 * the live-dot is the only signal needed. Credits sit small at the bottom.
 */

export const Close: React.FC = () => {
  const frame = useCurrentFrame();

  const urlOp = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const urlY = interpolate(frame, [0, 24], [10, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const creditsOp = interpolate(frame, [40, 70], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1500, padding: '0 80px', textAlign: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            opacity: urlOp,
            transform: `translateY(${urlY}px)`,
          }}
        >
          <LiveDot size={14} />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 96,
              fontWeight: 600,
              color: colors.ink[900],
              letterSpacing: '-0.025em',
              lineHeight: 1,
            }}
          >
            hermesgenesis.world
          </span>
        </div>

        {/* Credits — small editorial colophon */}
        <div
          style={{
            marginTop: 56,
            fontFamily: fonts.mono,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: colors.ink[500],
            opacity: creditsOp,
          }}
        >
          built on Hermes Genesis · Hermes-4 + Kimi K2.6 + Flux + ElevenLabs · music · Kevin MacLeod (CC BY 3.0)
        </div>
      </div>
    </AbsoluteFill>
  );
};
