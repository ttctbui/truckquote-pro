/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ttc: {
          blue:        '#1E1BB8',
          'blue-dark': '#1715A0',
          'blue-light':'#E8E8F8',
          yellow:      '#FFD400',
          'yellow-dark':'#E6BE00',
        },
        stat: {
          blue:   '#3B82F6',
          green:  '#10B981',
          orange: '#F97316',
          red:    '#EF4444',
          yellow: '#EAB308',
          purple: '#A855F7',
        },
        dark: {
          bg:      '#0E0F11',
          surface: '#18191C',
          border:  '#2A2B30',
          text:    '#E4E4E7',
          muted:   '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'ttc-card': '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
      },
    },
  },
  plugins: [],
}
