import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        wa:       '#25D366',
        'wa-dark':'#128C7E',
        ink:      '#0D0D0C',
        'ink-2':  '#2C2C29',
        'ink-3':  '#6B6B66',
        'ink-4':  '#9E9E99',
        border:   '#E8E7E2',
        bg:       '#F7F6F2',
      },
      fontFamily: {
        sans:    ['var(--font-dm-sans)', 'sans-serif'],
        display: ['var(--font-bricolage)', 'sans-serif'],
      },
      boxShadow: {
        sm:    '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        md:    '0 2px 8px rgba(0,0,0,.05), 0 6px 20px rgba(0,0,0,.07)',
        lg:    '0 4px 16px rgba(0,0,0,.06), 0 14px 44px rgba(0,0,0,.10)',
        xl:    '0 8px 32px rgba(0,0,0,.08), 0 24px 64px rgba(0,0,0,.12)',
        wa:    '0 2px 12px rgba(37,211,102,.30)',
        'wa-lg':'0 4px 24px rgba(37,211,102,.38)',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(22px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '.35' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up':   'fadeUp .5s ease both',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'shimmer':   'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
