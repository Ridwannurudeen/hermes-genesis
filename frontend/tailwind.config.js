export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        genesis: {
          50: '#faf6f0',
          100: '#f0e8d8',
          200: '#e0d2b8',
          300: '#c9b896',
          400: '#b8976a',
          500: '#a07d4e',
          600: '#8a6838',
          700: '#6f5228',
          800: '#543d1c',
          900: '#3d2c12',
          950: '#1a1410',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
