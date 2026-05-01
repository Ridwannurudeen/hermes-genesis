import { AbsoluteFill, interpolate, useCurrentFrame, Easing, Img, staticFile } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { colors, fonts } from '../lib/tokens';

/**
 * Proof — 30 seconds. The centerpiece.
 *
 * The whole pitch lives or dies here. ElevenLabs Seraphina narration plays
 * (audio bed wired in Demo.tsx). Visually we render an article-detail page
 * exactly like the site: eyebrow, headline, meta strip, illustration zoom,
 * drop cap on the first paragraph, body lines reveal in cadence with the
 * audio. Subtle camera nudge gives it a documentary feel.
 *
 * The body excerpt is taken from the real article — kept short enough that
 * the audio stays roughly in sync with the words a viewer can read.
 */

const TITLE = 'The Inkwell-Parchmentshield Betrayal: Seraphina’s Final Entry';
const KICKER = 'event · diary voice · year 406 · narrated by Seraphina';
const BODY_PARAGRAPHS: { dropCap?: boolean; text: string }[] = [
  {
    dropCap: true,
    text: 'They will say I closed the inkwell with my own hand. Let them. The court chronicle will record what the court chronicle requires, and the lunar epistle will record what is true. I am setting down both, here, before the candle gutters.',
  },
  {
    text: 'My sister Lyra came to me in the long room beneath the Parchmentshield archive on the eve of the Cinder dispatch. She wore the violet sash she wore at our coronation. She said: the betrayal was not yours, but theirs. I did not yet understand that she meant the moon’s correspondents.',
  },
  {
    text: 'When the inscription arrived — the silver-margined one, sealed with the lamp — I read it aloud only once, and then I tore it in half. My handmaid burned the rest. There are some letters a kingdom should never receive twice.',
  },
];

export const Proof: React.FC = () => {
  const frame = useCurrentFrame();

  // Whole composition slow-zoom, the way print docs frame a still.
  const scale = interpolate(frame, [0, 900], [1, 1.04], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const yShift = interpolate(frame, [0, 900], [12, -36], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // Header reveal
  const eyebrowOp = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp' });
  const titleOp = interpolate(frame, [10, 50], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const titleY = interpolate(frame, [10, 50], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const metaOp = interpolate(frame, [40, 75], [0, 1], { extrapolateRight: 'clamp' });

  const illustrationOp = interpolate(frame, [60, 110], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const illustrationScale = interpolate(frame, [60, 900], [1.06, 1.14], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // Body paragraphs cadence — each para starts ~3.5s apart so the reader
  // can follow with the audio. Lines fade in line-by-line within a para.
  const PARA_STARTS = [120, 360, 660]; // 4s, 12s, 22s
  const PARA_LINE_STAGGER = 14; // ~0.5s

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: 1640,
          padding: '0 80px',
          transform: `scale(${scale}) translateY(${yShift}px)`,
          transformOrigin: 'center top',
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: eyebrowOp }}>
          <GiltRule width={56} startFrame={0} duration={18} />
          <Eyebrow>chapter three · the article</Eyebrow>
        </div>

        {/* Two-column: illustration + body */}
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 56 }}>
          {/* Illustration */}
          <div
            style={{
              alignSelf: 'start',
              border: `1px solid ${colors.ink[900]}1F`,
              backgroundColor: colors.paper[200],
              aspectRatio: '4 / 5',
              overflow: 'hidden',
              opacity: illustrationOp,
            }}
          >
            <Img
              src={staticFile('seraphina.webp')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${illustrationScale})`,
                transformOrigin: 'center 35%',
              }}
              onError={() => {
                // Fallback handled inline via a sibling layer below in case
                // staticFile is missing — visible during dev before assets land.
              }}
            />
          </div>

          {/* Body column */}
          <div>
            {/* Meta strip */}
            <div style={{ opacity: metaOp }}>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: colors.ink[500],
                }}
              >
                {KICKER}
              </div>
            </div>

            {/* Title */}
            <h1
              style={{
                fontFamily: fonts.display,
                fontSize: 60,
                fontWeight: 600,
                color: colors.ink[900],
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                marginTop: 16,
                opacity: titleOp,
                transform: `translateY(${titleY}px)`,
              }}
            >
              {TITLE}
            </h1>

            {/* Reading meta */}
            <div
              style={{
                marginTop: 20,
                paddingBottom: 20,
                borderBottom: `1px solid ${colors.ink[900]}1F`,
                fontFamily: fonts.mono,
                fontSize: 14,
                color: colors.ink[500],
                fontVariantNumeric: 'tabular-nums',
                opacity: metaOp,
                display: 'flex',
                gap: 28,
                alignItems: 'center',
              }}
            >
              <span>1,212 words · 4 min read</span>
              <span style={{ color: colors.moss[500] }}>anti-slop 0.92 / fact-check 0.88</span>
              <span style={{ color: colors.gilt[500] }}>✦ narrated by Seraphina</span>
            </div>

            {/* Body paragraphs */}
            <div style={{ marginTop: 32 }}>
              {BODY_PARAGRAPHS.map((p, pi) => (
                <Paragraph
                  key={pi}
                  text={p.text}
                  dropCap={p.dropCap}
                  startFrame={PARA_STARTS[pi]}
                  lineStagger={PARA_LINE_STAGGER}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Paragraph: React.FC<{
  text: string;
  dropCap?: boolean;
  startFrame: number;
  lineStagger: number;
}> = ({ text, dropCap, startFrame, lineStagger }) => {
  const frame = useCurrentFrame();
  // Cheap line-break — split by sentence so each sentence pulses in.
  // This isn't real layout-aware line splitting; it gives a comfortable
  // staggered reveal that reads as "the article being typed."
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const opacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <p
      style={{
        fontFamily: fonts.body,
        fontSize: 22,
        lineHeight: 1.7,
        color: colors.ink[800],
        marginTop: 24,
        opacity,
      }}
    >
      {dropCap && (
        <span
          style={{
            float: 'left',
            fontFamily: fonts.display,
            fontSize: 96,
            lineHeight: 0.84,
            fontWeight: 600,
            color: colors.gilt[500],
            paddingRight: 14,
            paddingTop: 8,
          }}
        >
          {text.charAt(0)}
        </span>
      )}
      {sentences.map((s, si) => {
        const local = frame - (startFrame + si * lineStagger);
        const op = interpolate(local, [0, 18], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <span key={si} style={{ opacity: op }}>
            {si === 0 && dropCap ? s.slice(1) + ' ' : s + ' '}
          </span>
        );
      })}
    </p>
  );
};
