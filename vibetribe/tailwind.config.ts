import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Pitch under floodlights" palette
        pitch: {
          950: '#060F0B',
          900: '#0A1612',
          800: '#0F1F19',
          700: '#152A22',
          600: '#1F3A30',
          500: '#2D5042',
        },
        chalk: { DEFAULT: '#EAF2EC', dim: '#A9BDB1', faint: '#6F877A' },
        flood: { DEFAULT: '#FFD166', deep: '#E9B53A' },
        danger: '#FF7A6B',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        slideIn: { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        sheetUp: { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        slideIn: 'slideIn .22s ease-out',
        sheetUp: 'sheetUp .22s ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
