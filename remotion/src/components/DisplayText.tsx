import React from 'react';
import { colors, fonts } from '../lib/tokens';

/**
 * Display headline — Source Serif 4 Display, tight tracking, ink color.
 * Children can include a `<span style={{ fontStyle: 'italic', color: gilt }}>`
 * for the editorial accent on a single word.
 */
export const DisplayText: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 96, color = colors.ink[900], weight = 600, style }) => {
  return (
    <h1
      style={{
        fontFamily: fonts.display,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: 1.05,
        letterSpacing: '-0.025em',
        margin: 0,
        ...style,
      }}
    >
      {children}
    </h1>
  );
};

/** Italic gilt accent — used to lift one word inside a display headline. */
export const Accent: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = colors.gilt[500],
}) => {
  return (
    <span style={{ fontStyle: 'italic', color, fontWeight: 600 }}>{children}</span>
  );
};
