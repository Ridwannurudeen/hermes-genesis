import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { colors, fonts } from '../lib/tokens';

/**
 * Tabular metric strip — the same visual register as the site's StatsBanner.
 * Numbers spring into place with a slight stagger; labels stay still.
 */
export const MetricBand: React.FC<{
  cells: { value: string | number; label: string }[];
  startFrame?: number;
  staggerFrames?: number;
}> = ({ cells, startFrame = 0, staggerFrames = 6 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
        borderTop: `1px solid ${colors.ink[900]}1F`,
        borderBottom: `1px solid ${colors.ink[900]}1F`,
        gap: 0,
      }}
    >
      {cells.map((c, i) => (
        <Cell
          key={`${c.label}-${i}`}
          value={c.value}
          label={c.label}
          delayFrames={startFrame + i * staggerFrames}
        />
      ))}
    </div>
  );
};

const Cell: React.FC<{ value: string | number; label: string; delayFrames: number }> = ({
  value,
  label,
  delayFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delayFrames;
  const o = local <= 0 ? 0 : spring({ frame: local, fps, config: { damping: 14, stiffness: 90 } });
  return (
    <div
      style={{
        padding: '24px 28px',
        textAlign: 'center',
        borderRight: `1px solid ${colors.ink[900]}1F`,
        opacity: o,
        transform: `translateY(${(1 - o) * 14}px)`,
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 38,
          fontWeight: 600,
          color: colors.ink[900],
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 14,
          color: colors.ink[500],
          marginTop: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        }}
      >
        {label}
      </div>
    </div>
  );
};
