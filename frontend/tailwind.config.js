/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface:  '#0f0f10',
        panel:    '#18181b',
        border:   '#27272a',
        muted:    '#71717a',
        accent:   '#6366f1',
        'accent-dim': '#4f46e5',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
