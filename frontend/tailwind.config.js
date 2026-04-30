/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {

    // Numeric type scale, no Tailwind defaults. Editorial register.
    fontSize: {
      eyebrow: ['10px', { lineHeight: '1.2',  letterSpacing: '0.12em' }],
      micro:   ['11px', { lineHeight: '1.3' }],
      caption: ['12px', { lineHeight: '1.4' }],
      'body-sm': ['13px', { lineHeight: '1.5' }],
      body:    ['14px', { lineHeight: '1.55' }],
      'body-lg': ['15px', { lineHeight: '1.6' }],
      prose:   ['17px', { lineHeight: '1.7' }],   // article reading register
      h4: ['19px', { lineHeight: '1.3',  letterSpacing: '-0.01em' }],
      h3: ['22px', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
      h2: ['30px', { lineHeight: '1.18', letterSpacing: '-0.02em' }],
      h1: ['42px', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
      display:    ['64px', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
      'display-xl':['88px', { lineHeight: '0.96', letterSpacing: '-0.04em' }],

      // Tailwind compat — keep a few legacy names so unmigrated JSX still renders.
      // These map to the closest editorial-scale entry.
      xs:  ['12px', { lineHeight: '1.4' }],
      sm:  ['13px', { lineHeight: '1.5' }],
      base:['14px', { lineHeight: '1.55' }],
      lg:  ['15px', { lineHeight: '1.6' }],
      xl:  ['19px', { lineHeight: '1.3' }],
      '2xl': ['22px', { lineHeight: '1.25' }],
      '3xl': ['30px', { lineHeight: '1.18' }],
      '4xl': ['42px', { lineHeight: '1.08' }],
      '5xl': ['64px', { lineHeight: '1.02' }],
      '6xl': ['88px', { lineHeight: '0.96' }],
    },

    // Cards: md/lg only. Articles: 0 (sharp like print). Modals only: 2xl.
    borderRadius: {
      none: '0',
      sm:   '2px',
      DEFAULT: '4px',
      md:   '6px',
      lg:   '8px',
      xl:   '10px',
      '2xl': '14px',  // modals only
      full: '9999px',
    },

    extend: {
      colors: {
        // Editorial-AI palette — additive, rides alongside Tailwind defaults
        // during incremental page migration. Phase 4 will strip defaults.
        // Paper-and-vellum (light mode page) — warm off-white, never #FFF.
        paper: {
          50:  '#FDFBF6',
          100: '#F7F2E8',
          200: '#ECE3CF',
          300: '#D4C5A0',
          400: '#B8A578',
        },
        // Ink (light mode text) — warm-black, never #000.
        ink: {
          300: '#A8946F',
          400: '#8C7B5A',
          500: '#6B5A3D',
          600: '#4F4128',
          700: '#3F3220',
          800: '#2A2014',
          900: '#1A1208',
        },
        // Night (dark mode page) — warm-black with hue.
        night: {
          700: '#2A231C',
          800: '#1E1812',
          900: '#14100B',
          950: '#0E0A06',
        },
        // Vellum (dark mode text) — pale warm scale.
        vellum: {
          50:  '#FBF5E8',
          100: '#E8D9BC',
          200: '#CDB890',
          300: '#B8A085',
          400: '#8A7860',
          500: '#5C4F3D',
        },
        // Earned single accent — the canon stamp. Active states, signature
        // stats, "this is canon" indicators only. Never decorative.
        gilt: {
          400: '#D4A85F',
          500: '#B8893A',
          600: '#8B6624',
        },
        // Single semantic alert — destructive / rejection only.
        crimson: {
          400: '#D45A5A',
          500: '#B83A3A',
          600: '#8E2A2A',
        },
        // Living-canon — for "✓ canonized" badges only. Sparingly.
        moss: {
          400: '#6B8E5A',
          500: '#4F7240',
        },
      },

      fontFamily: {
        // Three-face system: editorial display + serif body for prose +
        // sans for chrome + mono for technical text.
        display: ['"Source Serif 4 Display"', '"Source Serif 4"', 'Georgia', 'serif'],
        body:    ['"Source Serif 4"', 'Georgia', 'serif'],
        ui:      ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        // Legacy alias — the old 'display' import was Cinzel; new code
        // should use the rebound display face above.
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Subtle pulse for "live" indicators — slower than animate-ping,
        // less attention-grabbing. Used on wire-feed live dots.
        livePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        // Number-flash on poll update — accent tint for 1200ms.
        numberFlash: {
          '0%': { backgroundColor: 'rgba(184, 137, 58, 0.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
        // Marquee for wire-service ticker — duplicate content + translate -50% for seamless loop.
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 700ms ease-out',
        livePulse: 'livePulse 2s ease-in-out infinite',
        numberFlash: 'numberFlash 1200ms ease-out',
        marquee: 'marquee 40s linear infinite',
      },

      // Hairline border weight — distinguish from default 1px.
      borderWidth: {
        hairline: '0.5px',
      },

      // Letter-spacing tokens for editorial moves.
      letterSpacing: {
        eyebrow: '0.12em',  // small-caps kicker labels
        kicker:  '0.16em',  // hero CTAs, "newspaper" buttons
      },
    },
  },
  plugins: [],
}
