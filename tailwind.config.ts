import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#080a0f',
          900: '#0d1018',
          850: '#111621',
          800: '#171d2a',
          750: '#1d2433',
          700: '#273044',
          600: '#343f57',
          500: '#47536d',
          400: '#69758e',
          300: '#8995ad',
          200: '#aab4c7',
          100: '#d4dbea',
          50: '#f3f6fc',
        },
        accent: {
          50: '#eef2ff',
          100: '#dce4ff',
          200: '#bdcbff',
          300: '#98adff',
          400: '#7893ff',
          500: '#5b78f5',
          600: '#465fd5',
          700: '#394daf',
          800: '#303f8a',
          900: '#29366e',
        },
        signal: {
          ok: '#34d399',
          warn: '#fbbf24',
          bad: '#f87171',
          idle: '#8b97ac',
          info: '#60a5fa',
          violet: '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.24), 0 12px 32px -18px rgba(0,0,0,.7)',
        glow: '0 0 0 1px rgba(120,147,255,.3), 0 12px 32px -12px rgba(91,120,245,.25)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
