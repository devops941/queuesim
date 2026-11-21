/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Futuristic Dark Theme Colors
        background: '#080D18',
        'background-secondary': '#0D1422',
        'sidebar-bg': '#0A101C',
        'card-bg': '#111B2B',
        'card-elevated': '#162236',
        border: '#24334A',
        'border-light': '#2E4160',
        
        // Brand & Accent Colors
        primary: {
          DEFAULT: '#4F8CFF',
          hover: '#3D7BF0',
          glow: 'rgba(79, 140, 255, 0.25)',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          glow: 'rgba(34, 211, 238, 0.25)',
        },
        teal: {
          DEFAULT: '#14B8A6',
          glow: 'rgba(20, 184, 166, 0.25)',
        },
        purple: {
          DEFAULT: '#A78BFA',
          glow: 'rgba(167, 139, 250, 0.25)',
        },
        success: {
          DEFAULT: '#22C55E',
          glow: 'rgba(34, 197, 94, 0.25)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          glow: 'rgba(245, 158, 11, 0.25)',
        },
        critical: {
          DEFAULT: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.25)',
        },
        
        // Text Colors
        'text-primary': '#F1F5F9',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
      },
      borderRadius: {
        card: '14px',
        bento: '16px',
        dialog: '18px',
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px #24334A',
        'card-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.6), 0 0 15px rgba(79, 140, 255, 0.15), 0 0 0 1px #2E4160',
        glow: '0 0 20px rgba(79, 140, 255, 0.35)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.35)',
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      keyframes: {
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-slow': 'pulseSlow 3s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [],
}
