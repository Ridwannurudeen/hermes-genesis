import { AbsoluteFill, interpolate, useCurrentFrame, Easing, spring, useVideoConfig } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { colors, fonts } from '../lib/tokens';

/**
 * Samples — 12 seconds. Show what the canon actually looks like at scale.
 *
 * Narration:
 *   "Nine hundred and sixty articles. Four eras."
 *
 * Visual: 6 real article cards from the canon, springy stagger in.
 * Each shows the real title + critic scores + audio/illustration markers.
 * This is the proof-by-volume move — judges see breadth.
 */

const ARTICLES = [
  {
    title: "The Inkwell-Parchmentshield Betrayal: Seraphina's Final Entry",
    kind: 'event',
    voice: 'diary',
    year: 406,
    slop: 0.92,
    fact: 0.88,
    audio: true,
    illustrated: true,
  },
  {
    title: 'Lyor Inkwell: Final Entry',
    kind: 'person',
    voice: 'diary',
    year: 412,
    slop: 0.89,
    fact: 0.86,
    audio: true,
    illustrated: true,
  },
  {
    title: 'The Quillspire Schism: A Cultural Reckoning',
    kind: 'event',
    voice: 'scholarly',
    year: 318,
    slop: 0.86,
    fact: 0.91,
    audio: false,
    illustrated: true,
  },
  {
    title: 'Inkwell-Parchmentshield Rivalry Reaches Boiling Point',
    kind: 'event',
    voice: 'newspaper',
    year: 384,
    slop: 0.84,
    fact: 0.87,
    audio: false,
    illustrated: true,
  },
  {
    title: 'Seraphina Parchmentshield: A Court Chronicle',
    kind: 'person',
    voice: 'court',
    year: 372,
    slop: 0.91,
    fact: 0.90,
    audio: false,
    illustrated: true,
  },
  {
    title: 'The Cinder Pass Cataclysm: Inkwell and Moonshadow',
    kind: 'event',
    voice: 'scripture',
    year: 401,
    slop: 0.87,
    fact: 0.85,
    audio: false,
    illustrated: true,
  },
];

export const Samples: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowOp = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp' });
  const counterOp = interpolate(frame, [10, 60], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Counter spins from 0 to 960
  const articleCount = Math.round(
    interpolate(frame, [10, 90], [0, 960], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }),
  );
  const eraCount = Math.round(
    interpolate(frame, [10, 90], [0, 4], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }),
  );

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1740, padding: '0 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: eyebrowOp }}>
          <GiltRule width={56} startFrame={0} duration={18} />
          <Eyebrow>chapter five · the canon at scale</Eyebrow>
        </div>

        {/* Big stat strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 64,
            marginTop: 14,
            opacity: counterOp,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 96,
                fontWeight: 600,
                color: colors.ink[900],
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {articleCount}
            </div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 14,
                color: colors.ink[500],
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                marginTop: 6,
              }}
            >
              articles
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 96,
                fontWeight: 600,
                color: colors.gilt[500],
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {eraCount}
            </div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 14,
                color: colors.ink[500],
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                marginTop: 6,
              }}
            >
              eras
            </div>
          </div>
          <div style={{ flex: 1 }} />
        </div>

        {/* Article cards grid */}
        <div
          style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {ARTICLES.map((a, i) => {
            const start = 30 + i * 7;
            const f = frame - start;
            const op = f <= 0 ? 0 : spring({ frame: f, fps, config: { damping: 16, stiffness: 100 } });
            const y = interpolate(op, [0, 1], [16, 0]);
            return (
              <div
                key={a.title}
                style={{
                  border: `1px solid ${colors.ink[900]}14`,
                  padding: '20px 22px',
                  backgroundColor: colors.paper[100],
                  minHeight: 180,
                  opacity: op,
                  transform: `translateY(${y}px)`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    color: colors.ink[500],
                  }}
                >
                  <span>{a.kind}</span>
                  <span style={{ color: colors.ink[400] }}>·</span>
                  <span>{a.voice}</span>
                  <span style={{ color: colors.ink[400] }}>·</span>
                  <span>year {a.year}</span>
                </div>
                <div
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 20,
                    fontWeight: 600,
                    color: colors.ink[900],
                    letterSpacing: '-0.012em',
                    lineHeight: 1.2,
                    marginTop: 8,
                  }}
                >
                  {a.title}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  {a.illustrated && (
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        color: colors.gilt[500],
                        border: `1px solid ${colors.gilt[500]}66`,
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      art
                    </span>
                  )}
                  {a.audio && (
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        color: colors.gilt[500],
                        border: `1px solid ${colors.gilt[500]}66`,
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      audio
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 13,
                      color: colors.moss[500],
                      fontVariantNumeric: 'tabular-nums',
                      marginLeft: 'auto',
                    }}
                  >
                    {a.slop.toFixed(2)} / {a.fact.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
