import React from 'react';
import { useCurrentFrame } from 'remotion';
import { colors } from '../lib/tokens';

/** Pulsing live-dot — same beat as the site's `livePulse` keyframe. */
export const LiveDot: React.FC<{ size?: number; color?: string }> = ({
  size = 8,
  color = colors.gilt[500],
}) => {
  const frame = useCurrentFrame();
  // 2s pulse, 0.55–1.0 opacity — matches the site keyframe.
  const t = (frame % 60) / 60;
  const opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI));
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 9999,
        backgroundColor: color,
        opacity,
        boxShadow: `0 0 ${size * 2}px ${color}33`,
      }}
    />
  );
};
