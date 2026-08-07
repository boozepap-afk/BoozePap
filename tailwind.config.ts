import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#B11226',
          deep: '#8B0000',
          soft: '#F7F4EE',
          ink: '#0B0B0B',
          gold: '#C9A227',
          lightGold: '#E2C15A',
        },
      },
      boxShadow: {
        orange: '0 18px 45px rgba(177, 18, 38, .18)',
        card: '0 12px 28px rgba(33, 20, 15, .12)',
      },
    },
  },
  plugins: [],
};

export default config;
