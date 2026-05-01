import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { DisplayText, Accent } from '../components/DisplayText';
import { colors, fonts } from '../lib/tokens';

/**
 * Cold open — 8 seconds.
 *
 *  0.0–1.5  The eyebrow appears: HERMES GENESIS · CHRONICLON
 *  1.5–4.0  The display headline fades in word-by-word, last word italic gilt
 *  4.0–6.5  Hold; gilt rule under the line draws itself
 *  6.5–8.0  Subtitle line, then everything begins to lift toward the next cut
 */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  // Word-by-word reveal of "A wikipedia for a world that doesn't exist."
  const words = ['A', 'wikipedia', 'for', 'a', 'world', 'that', 'doesn’t', 'exist.'];
  const wordStart = 45; // 1.5s
  const wordStep = 8;   // ~0.27s per word

  const eyebrowOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const subtitleOpacity = interpolate(frame, [200, 230], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  // Slow, almost imperceptible upward drift on the whole stack — gives the
  // composition a cinematic settle, not a static title card.
  const drift = interpolate(frame, [0, 240], [12, -4], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          padding: '0 80px',
          transform: `translateY(${drift}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: eyebrowOpacity }}>
          <GiltRule width={56} startFrame={6} duration={20} />
          <Eyebrow>Hermes Genesis · Chroniclon</Eyebrow>
        </div>

        <div style={{ marginTop: 36, lineHeight: 1.04 }}>
          {words.map((w, i) => {
            const isLast = i === words.length - 1;
            const f = frame - (wordStart + i * wordStep);
            const op = interpolate(f, [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            const y = interpolate(f, [0, 14], [10, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            return (
              <span
                key={`${w}-${i}`}
                style={{
                  fontFamily: fonts.display,
                  fontSize: 124,
                  fontWeight: 600,
                  letterSpacing: '-0.035em',
                  color: isLast ? colors.gilt[500] : colors.ink[900],
                  fontStyle: isLast ? 'italic' : 'normal',
                  display: 'inline-block',
                  marginRight: 24,
                  opacity: op,
                  transform: `translateY(${y}px)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            opacity: subtitleOpacity,
          }}
        >
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: 28,
              fontStyle: 'italic',
              color: colors.ink[600],
              letterSpacing: '-0.005em',
            }}
          >
            One sentence in. A self-writing canon out.
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
