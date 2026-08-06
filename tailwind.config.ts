import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FF5A00',
          deep: '#002653',
          soft: '#FFF5EC',
          ink: '#002653',
        },
      },
      boxShadow: {
        orange: '0 18px 45px rgba(240, 90, 26, .24)',
        card: '0 12px 28px rgba(33, 20, 15, .12)',
      },
    },
  },
  plugins: [],
};

export default config;
