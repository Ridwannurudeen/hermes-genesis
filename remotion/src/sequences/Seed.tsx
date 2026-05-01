import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { Eyebrow } from '../components/Eyebrow';
import { GiltRule } from '../components/GiltRule';
import { MetricBand } from '../components/MetricBand';
import { colors, fonts } from '../lib/tokens';

/**
 * Seed — 14 seconds (frames 0–420 within the sequence).
 *
 *   0.0–4.0   Cursor types out the seed sentence
 *   4.0–6.0   Hold; the line settles
 *   6.0–9.5   Three stages animate in below: geography, factions, characters
 *  10.0–14.0  Metric band springs in: 3 regions · 5 factions · 12 characters · 7 days
 *
 * Editorial point: the moment the user "presses generate." The prose forms,
 * the world spawns, the metrics anchor it. This is the core promise.
 */

const SEED_TEXT = 'A world where the moon is sentient and writes letters to the queen.';

export const Seed: React.FC = () => {
  const frame = useCurrentFrame();

  // Type effect: 1 char per ~1.7 frames (about 17.5 chars/s).
  const charsPerFrame = SEED_TEXT.length / 110;
  const charsShown = Math.min(SEED_TEXT.length, Math.floor(frame * charsPerFrame));
  const typed = SEED_TEXT.slice(0, charsShown);
  const cursorVisible = frame % 30 < 15 && charsShown < SEED_TEXT.length;

  const stagesStart = 180; // 6.0s
  const stages = [
    { label: 'geography', body: 'three regions chartered, four climates.' },
    { label: 'factions', body: 'five houses with rival ideologies.' },
    { label: 'characters', body: 'twelve agents with persistent genomes.' },
  ];

  const metricStart = 300; // 10s

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 1480, padding: '0 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <GiltRule width={56} duration={18} />
          <Eyebrow>chapter one · the seed</Eyebrow>
        </div>

        {/* Typing area — paper textarea register, ink cursor */}
        <div
          style={{
            marginTop: 36,
            border: `1px solid ${colors.ink[900]}1A`,
            borderRadius: 6,
            padding: '32px 36px',
            backgroundColor: colors.paper[100],
          }}
        >
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 44,
              color: colors.ink[900],
              lineHeight: 1.35,
              letterSpacing: '-0.012em',
              minHeight: 120,
            }}
          >
            {typed}
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 36,
                backgroundColor: colors.ink[900],
                marginLeft: 4,
                verticalAlign: '-6px',
                opacity: cursorVisible ? 1 : 0,
              }}
            />
          </div>
        </div>

        {/* Stages */}
        <div
          style={{
            marginTop: 44,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
          }}
        >
          {stages.map((s, i) => {
            const f = frame - (stagesStart + i * 18);
            const op = interpolate(f, [0, 22], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            const y = interpolate(f, [0, 22], [12, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            return (
              <div
                key={s.label}
                style={{
                  border: `1px solid ${colors.ink[900]}14`,
                  padding: '20px 24px',
                  opacity: op,
                  transform: `translateY(${y}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    color: colors.gilt[500],
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 22,
                    color: colors.ink[700],
                    marginTop: 8,
                    fontStyle: 'italic',
                    lineHeight: 1.4,
                  }}
                >
                  {s.body}
                </div>
              </div>
            );
          })}
        </div>

        {/* Metric band */}
        <div style={{ marginTop: 48 }}>
          <MetricBand
            startFrame={metricStart}
            cells={[
              { value: '3', label: 'regions' },
              { value: '5', label: 'factions' },
              { value: '12', label: 'characters' },
              { value: '7', label: 'days simulated' },
            ]}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
