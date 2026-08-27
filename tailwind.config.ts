import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#D94A57',
          deep: '#B92F3D',
          soft: '#FFF8F6',
          ink: '#241A1A',
          gold: '#C9A227',
          lightGold: '#E8CD72',
        },
      },
      boxShadow: {
        orange: '0 16px 36px rgba(185, 47, 61, .14)',
        card: '0 10px 24px rgba(33, 20, 15, .09)',
      },
    },
  },
  plugins: [],
};

export default config;
