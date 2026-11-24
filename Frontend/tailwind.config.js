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
        navy: {
          950: '#060911',
          900: '#0B0F19', // Main canvas background
          850: '#0D1424',
          800: '#111827', // Card surface
          750: '#131C31', // Elevated card surface
          700: '#1E293B', // Border color
          600: '#334155',
        },
        cyber: {
          blue: '#3B82F6',
          'blue-dark': '#2563EB',
          'blue-light': '#60A5FA',
          green: '#10B981',
          red: '#EF4444',
          rose: '#F43F5E',
          purple: '#8B5CF6',
          cyan: '#06B6D4',
          amber: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px -3px rgba(59, 130, 246, 0.35)',
        'glow-green': '0 0 20px -3px rgba(16, 185, 129, 0.35)',
        'glow-red': '0 0 20px -3px rgba(239, 68, 68, 0.35)',
        'glow-purple': '0 0 20px -3px rgba(139, 92, 246, 0.35)',
        'card-glow': '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.08)',
      },
    },
  },
  plugins: [],
};

