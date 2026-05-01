import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { colors, fonts } from '../lib/tokens';

/**
 * Cold Open — 3 seconds. Title card that lands clean.
 *
 * Narration over this sequence:
 *   "Chroniclon. A wikipedia for a world that doesn't exist."
 *
 * Held the whole 3s. No word-by-word reveal — the previous cut tried to
 * choreograph each word and ran ahead of the narrator. New approach:
 * fade headline in as one block, hold, fade out.
 */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  const eyebrowOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const headlineOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const headlineY = interpolate(frame, [10, 30], [12, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1500, padding: '0 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: eyebrowOp }}>
          <GiltRule width={56} startFrame={4} duration={16} />
          <Eyebrow>hermes genesis · live</Eyebrow>
        </div>

        <div
          style={{
            marginTop: 28,
            opacity: headlineOp,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 168,
              fontWeight: 600,
              color: colors.ink[900],
              letterSpacing: '-0.035em',
              lineHeight: 0.95,
            }}
          >
            Chroniclon
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 36,
              fontStyle: 'italic',
              color: colors.gilt[500],
              marginTop: 18,
              letterSpacing: '-0.005em',
            }}
          >
            a wikipedia for a world that doesn't exist
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
