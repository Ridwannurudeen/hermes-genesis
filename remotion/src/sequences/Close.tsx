import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { LiveDot } from '../components/LiveDot';
import { colors, fonts } from '../lib/tokens';

/**
 * Close — 8 seconds. The signoff.
 *
 *  0–2  Eyebrow + rule
 *  2–4  Stats line counts in: 960 articles · 4 eras · 1 sentence in
 *  4–6  Wordmark and tagline
 *  6–8  URL + live-dot · "still publishing." Hold.
 */

export const Close: React.FC = () => {
  const frame = useCurrentFrame();

  const eyebrowOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const wordmarkOp = interpolate(frame, [60, 110], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const wordmarkY = interpolate(frame, [60, 110], [12, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const taglineOp = interpolate(frame, [90, 130], [0, 1], { extrapolateRight: 'clamp' });
  const urlOp = interpolate(frame, [140, 180], [0, 1], { extrapolateRight: 'clamp' });
  const stillOp = interpolate(frame, [170, 210], [0, 1], { extrapolateRight: 'clamp' });

  // Stats numbers count up.
  const articles = Math.round(interpolate(frame, [40, 110], [0, 960], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  }));
  const eras = Math.round(interpolate(frame, [40, 110], [0, 4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  }));

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1500, padding: '0 80px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, opacity: eyebrowOp }}>
          <GiltRule width={56} startFrame={0} duration={18} />
          <Eyebrow>colophon</Eyebrow>
          <GiltRule width={56} startFrame={0} duration={18} />
        </div>

        {/* Stats line */}
        <div
          style={{
            marginTop: 28,
            fontFamily: fonts.mono,
            fontSize: 22,
            color: colors.ink[600],
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.04em',
            opacity: interpolate(frame, [40, 80], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <span style={{ color: colors.ink[900] }}>{articles}</span> articles  ·
          <span style={{ color: colors.ink[900], marginLeft: 12 }}>{eras}</span> eras  ·
          <span style={{ color: colors.ink[900], marginLeft: 12 }}>1</span> sentence in
        </div>

        {/* Wordmark */}
        <div
          style={{
            marginTop: 56,
            opacity: wordmarkOp,
            transform: `translateY(${wordmarkY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 132,
              fontWeight: 600,
              color: colors.ink[900],
              letterSpacing: '-0.035em',
              lineHeight: 1,
            }}
          >
            Chroniclon
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 24,
            fontFamily: fonts.body,
            fontSize: 26,
            fontStyle: 'italic',
            color: colors.ink[600],
            opacity: taglineOp,
            letterSpacing: '-0.005em',
          }}
        >
          a wikipedia for a world that doesn’t exist
        </div>

        {/* URL + live dot */}
        <div
          style={{
            marginTop: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            fontFamily: fonts.mono,
            fontSize: 20,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: colors.gilt[500],
            opacity: urlOp,
          }}
        >
          <LiveDot />
          <span>HERMESGENESIS.WORLD</span>
          <span style={{ color: colors.ink[500] }}>·</span>
          <span style={{ color: colors.ink[500], opacity: stillOp }}>still publishing</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
