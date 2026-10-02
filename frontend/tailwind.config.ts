import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#070b14',
        panel: '#0d1424',
        frost: 'rgba(255, 255, 255, 0.08)',
        legal: {
          gold: '#d9b76f',
          teal: '#35d3c8',
          blue: '#7aa7ff',
          red: '#ff5f6d',
          amber: '#ffb454',
          green: '#48d597',
        },
      },
      boxShadow: {
        glow: '0 24px 80px rgba(53, 211, 200, 0.14)',
        danger: '0 24px 80px rgba(255, 95, 109, 0.18)',
      },
      backgroundImage: {
        'legal-grid':
          'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
