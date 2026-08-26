import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0b1220',
      },
    },
  },
  plugins: [],
} satisfies Config;
