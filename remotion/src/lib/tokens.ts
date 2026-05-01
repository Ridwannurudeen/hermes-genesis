/**
 * Editorial token re-exports — mirrors frontend/tailwind.config.js so the
 * video reads as part of the same publication. If you change a token in the
 * site, change it here too. Keep them in lockstep.
 */
export const colors = {
  paper: {
    50: '#FDFBF6',
    100: '#F7F2E8',
    200: '#ECE3CF',
    300: '#D4C5A0',
  },
  ink: {
    300: '#A8946F',
    400: '#8C7B5A',
    500: '#6B5A3D',
    600: '#4F4128',
    700: '#3F3220',
    800: '#2A2014',
    900: '#1A1208',
  },
  night: {
    800: '#1E1812',
    900: '#14100B',
    950: '#0E0A06',
  },
  vellum: {
    50: '#FBF5E8',
    100: '#E8D9BC',
    200: '#CDB890',
    300: '#B8A085',
    400: '#8A7860',
  },
  gilt: {
    400: '#D4A85F',
    500: '#B8893A',
    600: '#8B6624',
  },
  crimson: {
    400: '#D45A5A',
    500: '#B83A3A',
  },
  moss: {
    400: '#6B8E5A',
    500: '#4F7240',
  },
} as const;

/** Three-face system. Site uses Geist for UI; Remotion uses Inter as the
 * closest @remotion/google-fonts equivalent (Geist isn't bundled there).
 * Visually indistinguishable at the small sizes we use it for. */
export const fonts = {
  display: '"Source Serif 4 Display", "Source Serif 4", Georgia, serif',
  body: '"Source Serif 4", Georgia, serif',
  ui: '"Inter", "Geist", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
} as const;

/** Composition-wide constants. 90s @ 30fps = 2700 frames. */
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_DURATION = 90 * FPS; // 2700

/** Sequence boundaries, in frames. Keep in lockstep with Demo.tsx. */
export const TIMING = {
  coldOpen: { from: 0, duration: 8 * FPS },           //   0 –  8s
  seed: { from: 8 * FPS, duration: 14 * FPS },        //   8 – 22s
  pipeline: { from: 22 * FPS, duration: 16 * FPS },   //  22 – 38s
  proof: { from: 38 * FPS, duration: 30 * FPS },      //  38 – 68s
  drift: { from: 68 * FPS, duration: 14 * FPS },      //  68 – 82s
  close: { from: 82 * FPS, duration: 8 * FPS },       //  82 – 90s
} as const;
