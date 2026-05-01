import { AbsoluteFill } from 'remotion';
import { colors } from '../lib/tokens';

/**
 * Paper grain — fine SVG noise overlay. Same atmospheric layer as the
 * site's body::before pattern, baked into the video so the editorial
 * surface reads as paper, not screen-white.
 */
export const PaperGrain: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, opacity: 0.6 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="0.45" fill={colors.ink[900]} fillOpacity="0.07" />
          </pattern>
          <radialGradient id="halo" cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor={colors.gilt[400]} stopOpacity="0.06" />
            <stop offset="60%" stopColor={colors.gilt[400]} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grain)" />
        <rect width="100%" height="100%" fill="url(#halo)" />
      </svg>
    </AbsoluteFill>
  );
};
