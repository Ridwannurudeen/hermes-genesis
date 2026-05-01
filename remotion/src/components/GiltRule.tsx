import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors } from '../lib/tokens';

/**
 * Gilt rule — short hairline that draws itself in. Editorial signature
 * placed above every section title. Animated width interpolation gives
 * it a "calligrapher's pen-stroke" feel rather than a hard fade.
 */
export const GiltRule: React.FC<{
  width?: number;
  startFrame?: number;
  duration?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ width = 160, startFrame = 0, duration = 18, color = colors.gilt[500], style }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [startFrame, startFrame + duration], [0, width], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <span
      style={{
        display: 'inline-block',
        width: w,
        height: 2,
        backgroundColor: color,
        verticalAlign: 'middle',
        ...style,
      }}
    />
  );
};
