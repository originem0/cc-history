/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#f8f9fa',
        raised: '#ffffff',
        surface: '#f0f1f3',
        overlay: '#ffffff',
        accent: {
          DEFAULT: '#d97706',
          dim: 'rgba(217, 119, 6, 0.12)',
          glow: 'rgba(217, 119, 6, 0.06)',
        },
        'user-bubble': '#2563eb',
        danger: '#ef4444',
        subtle: 'rgba(0, 0, 0, 0.08)',
        medium: 'rgba(0, 0, 0, 0.12)',
        'text-primary': '#1a1a1a',
        'text-secondary': '#5f6368',
        'text-tertiary': '#9aa0a6',
      },
      fontFamily: {
        sans: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'lg': '10px',
        'xl': '14px',
        '2xl': '18px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(217, 119, 6, 0.08)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'dropdown': '0 12px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
