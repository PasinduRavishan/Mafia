/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:          '#0d0d0d',
        card:        '#1a1a2e',
        'card-alt':  '#16213e',
        accent:      '#e8a838',
        'accent-dim':'#b8821a',
        mafia:       '#c0392b',
        detective:   '#2980b9',
        medic:       '#27ae60',
        villager:    '#7f8c8d',
        muted:       '#4a4a5a',
      },
      fontFamily: {
        cinzel: ['"Cinzel Decorative"', 'serif'],
        lora:   ['Lora', 'serif'],
        inter:  ['Inter', 'sans-serif'],
        mono:   ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        'lantern-flicker': {
          '0%, 100%': { opacity: '1' },
          '10%':      { opacity: '0.85' },
          '30%':      { opacity: '0.95' },
          '50%':      { opacity: '0.80' },
          '70%':      { opacity: '1' },
          '90%':      { opacity: '0.88' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(232,168,56,0.4)' },
          '50%':      { boxShadow: '0 0 20px 6px rgba(232,168,56,0.8)' },
        },
        'pulse-red': {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(192,57,43,0.5)' },
          '50%':      { boxShadow: '0 0 24px 8px rgba(192,57,43,0.9)' },
        },
        'fog-drift': {
          '0%':   { transform: 'translateX(-10%) scaleX(1)' },
          '50%':  { transform: 'translateX(5%) scaleX(1.05)' },
          '100%': { transform: 'translateX(-10%) scaleX(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'lantern':    'lantern-flicker 4s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'pulse-red':  'pulse-red 1s ease-in-out infinite',
        'fog':        'fog-drift 18s ease-in-out infinite',
        float:        'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        mafia: {
          'primary':         '#e8a838',
          'primary-content': '#0d0d0d',
          'secondary':       '#2980b9',
          'accent':          '#27ae60',
          'neutral':         '#1a1a2e',
          'base-100':        '#0d0d0d',
          'base-200':        '#1a1a2e',
          'base-300':        '#16213e',
          'base-content':    '#e8e8e8',
          'error':           '#c0392b',
        },
      },
    ],
    darkTheme: 'mafia',
  },
}
