import { AbsoluteFill, interpolate, useCurrentFrame, Easing, spring, useVideoConfig } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { colors, fonts } from '../lib/tokens';

/**
 * Drift — 14 seconds. The conlang signature.
 *
 * The differentiator vs every other autonomous-fiction project. We show the
 * lexicon mutating across eras with academic rigor: a phonological rule, then
 * three lexicon entries morphing through three eras. Editorial typography:
 * IPA-style brackets, era markers in mono, gilt arrow between forms.
 */

type EraEntry = { era: string; year: number; word: string };
type Lex = { english: string; trail: EraEntry[] };

const PHONO_RULE = {
  desc: 'Phonological shift — Cinder Era (year 312)',
  rule: '/k/ → /tʃ/  /  V_V',
  gloss: 'Velar stops palatalize between vowels.',
};

const LEXICON: Lex[] = [
  {
    english: 'moon',
    trail: [
      { era: 'Lunar', year: 80, word: 'karim' },
      { era: 'Cinder', year: 320, word: 'cherim' },
      { era: 'Ash', year: 540, word: 'cherim-en' },
    ],
  },
  {
    english: 'queen',
    trail: [
      { era: 'Lunar', year: 80, word: 'asukai' },
      { era: 'Cinder', year: 320, word: 'asuya' },
      { era: 'Ash', year: 540, word: 'suya' },
    ],
  },
  {
    english: 'inkwell',
    trail: [
      { era: 'Lunar', year: 80, word: 'tikomu' },
      { era: 'Cinder', year: 320, word: 'tichomu' },
      { era: 'Ash', year: 540, word: 'chomu' },
    ],
  },
];

export const Drift: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowOp = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: 'clamp' });

  // Phonological rule reveal
  const ruleOp = interpolate(frame, [20, 60], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1640, padding: '0 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: eyebrowOp }}>
          <GiltRule width={56} startFrame={0} duration={18} />
          <Eyebrow>chapter four · linguistic drift</Eyebrow>
        </div>

        {/* Phonological rule card */}
        <div
          style={{
            marginTop: 28,
            padding: '24px 32px',
            border: `1px solid ${colors.ink[900]}1F`,
            backgroundColor: colors.paper[100],
            opacity: ruleOp,
          }}
        >
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: colors.ink[500],
            }}
          >
            {PHONO_RULE.desc}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 28 }}>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 38,
                fontWeight: 600,
                color: colors.ink[900],
              }}
            >
              {PHONO_RULE.rule}
            </span>
            <span
              style={{
                fontFamily: fonts.body,
                fontSize: 19,
                fontStyle: 'italic',
                color: colors.ink[600],
              }}
            >
              {PHONO_RULE.gloss}
            </span>
          </div>
        </div>

        {/* Lexicon table */}
        <div style={{ marginTop: 36 }}>
          {LEXICON.map((lex, idx) => (
            <LexRow key={lex.english} lex={lex} startFrame={80 + idx * 28} fps={fps} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LexRow: React.FC<{ lex: Lex; startFrame: number; fps: number }> = ({ lex, startFrame, fps }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [startFrame, startFrame + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const yShift = interpolate(op, [0, 1], [10, 0]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        alignItems: 'center',
        padding: '18px 0',
        borderBottom: `1px solid ${colors.ink[900]}14`,
        opacity: op,
        transform: `translateY(${yShift}px)`,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 32,
          fontWeight: 600,
          color: colors.ink[900],
          letterSpacing: '-0.01em',
        }}
      >
        {lex.english}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 36, flexWrap: 'wrap' }}>
        {lex.trail.map((entry, ei) => {
          const localStart = startFrame + 14 + ei * 18;
          const localOp = interpolate(frame, [localStart, localStart + 14], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const localY = interpolate(localOp, [0, 1], [6, 0]);
          return (
            <div
              key={`${entry.era}-${ei}`}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                opacity: localOp,
                transform: `translateY(${localY}px)`,
              }}
            >
              {ei > 0 && (
                <span
                  aria-hidden
                  style={{
                    color: colors.gilt[500],
                    fontFamily: fonts.mono,
                    fontSize: 22,
                    marginRight: 8,
                  }}
                >
                  →
                </span>
              )}
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 26,
                  fontWeight: 500,
                  color: colors.gilt[500],
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {entry.word}
              </span>
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: colors.ink[500],
                }}
              >
                {entry.era} · y{entry.year}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
