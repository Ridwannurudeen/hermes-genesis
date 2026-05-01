import React from 'react';
import { colors, fonts } from '../lib/tokens';

/**
 * Small-caps mono kicker — the editorial typographic signature. Used to
 * frame every section so the viewer never loses orientation.
 */
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, color = colors.gilt[500], style }) => {
  return (
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 18,
        textTransform: 'uppercase',
        letterSpacing: '0.32em',
        color,
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
    </span>
  );
};
