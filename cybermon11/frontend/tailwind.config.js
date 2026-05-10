/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface':                '#0b1326',
        'surface-container-lowest': '#060e20',
        'surface-container-low':  '#131b2e',
        'surface-container':      '#171f33',
        'surface-container-high': '#222a3d',
        'surface-container-highest': '#2d3449',
        'surface-variant':        '#2d3449',
        'on-surface':             '#dae2fd',
        'on-surface-variant':     '#c2c6d6',
        'primary':                '#adc6ff',
        'primary-container':      '#4d8eff',
        'on-primary':             '#002e6a',
        'on-primary-container':   '#00285d',
        'secondary':              '#ffb3ad',
        'secondary-container':    '#a40217',
        'on-secondary-container': '#ffaea8',
        'tertiary':               '#4edea3',
        'tertiary-container':     '#00a572',
        'error':                  '#ffb4ab',
        'error-container':        '#93000a',
        'on-error-container':     '#ffdad6',
        'outline':                '#8c909f',
        'outline-variant':        '#424754',
        'on-background':          '#dae2fd',
        'background':             '#0b1326',
      },
      fontFamily: {
        headline: ['Space Grotesk', 'sans-serif'],
        body:     ['Inter', 'sans-serif'],
        mono:     ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
