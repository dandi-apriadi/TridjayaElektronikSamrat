import typography from '@tailwindcss/typography';

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
        // Theme-aware semantic colors
        'surface': 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-low': 'rgb(var(--color-surface-low) / <alpha-value>)',
        'surface-container': 'rgb(var(--color-surface-container) / <alpha-value>)',
        'surface-high': 'rgb(var(--color-surface-high) / <alpha-value>)',
        'surface-highest': 'rgb(var(--color-surface-highest) / <alpha-value>)',
        'surface-bright': 'rgb(var(--color-surface-bright) / <alpha-value>)',

        'primary': 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-dim': 'rgb(var(--color-primary-dim) / <alpha-value>)',
        'primary-container': 'rgb(var(--color-primary-container) / <alpha-value>)',

        'secondary': 'rgb(var(--color-secondary) / <alpha-value>)',
        'secondary-dim': 'rgb(var(--color-secondary-dim) / <alpha-value>)',
        'secondary-container': 'rgb(var(--color-secondary-container) / <alpha-value>)',

        'tertiary': 'rgb(var(--color-tertiary) / <alpha-value>)',
        'tertiary-container': 'rgb(var(--color-tertiary-container) / <alpha-value>)',

        'on-surface': 'rgb(var(--color-on-surface) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        'on-secondary': 'rgb(var(--color-on-secondary) / <alpha-value>)',

        // Light Mode (Warm Mist)
        'warm-mist': '#F2F2F2',
        'warm-mist-dark': '#E5E5E5',
        'indigo': '#3F51B5',
        'indigo-dark': '#303F9F',

        // Semantic
        'neon-cyan': '#00F0FF',
        'neon-lime': '#ADFF2F',
        'neon-magenta': '#FF00FF',

        // Errors
        'error': 'rgb(var(--color-error) / <alpha-value>)',
        'on-error': 'rgb(var(--color-on-error) / <alpha-value>)',

        // Outline
        'outline': 'rgb(var(--color-outline) / <alpha-value>)',
        'outline-variant': 'rgb(var(--color-outline-variant) / <alpha-value>)',
      },
      fontFamily: {
        'display': ['"Space Grotesk"', 'sans-serif'],
        'body': ['Manrope', 'sans-serif'],
        'sans': ['Manrope', '"Space Grotesk"', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.05em', fontWeight: '700' }],
        'display-md': ['2.8rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display-sm': ['2.2rem', { lineHeight: '1.2', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline-lg': ['2rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['1.75rem', { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-sm': ['1.5rem', { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-lg': ['1.375rem', { lineHeight: '1.4', fontWeight: '600' }],
        'title-md': ['1.125rem', { lineHeight: '1.5', fontWeight: '500' }],
        'title-sm': ['0.9375rem', { lineHeight: '1.5', fontWeight: '500' }],
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.75rem', { lineHeight: '1.6', fontWeight: '400' }],
        'label-lg': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.1em', fontWeight: '700' }],
        'label-md': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.15em', fontWeight: '700' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.2em', fontWeight: '800' }],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '40px',
      },
      backdropBlur: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '40px',
        '2xl': '64px',
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(143, 245, 255, 0.3), 0 0 40px rgba(143, 245, 255, 0.1)',
        'neon-cyan-sm': '0 0 10px rgba(143, 245, 255, 0.2)',
        'neon-lime': '0 0 20px rgba(162, 243, 31, 0.3), 0 0 40px rgba(162, 243, 31, 0.1)',
        'neon-magenta': '0 0 20px rgba(255, 81, 250, 0.3), 0 0 40px rgba(255, 81, 250, 0.1)',
        'ambient-dark': '0 24px 48px rgba(0, 0, 0, 0.25), 0 8px 16px rgba(0, 0, 0, 0.1)',
        'ambient-light': '0 24px 48px rgba(0, 30, 64, 0.08), 0 8px 16px rgba(0, 30, 64, 0.04)',
        'glass': 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.6s ease-out',
        'fade-in': 'fade-in 0.4s ease-out',
        'gradient-shift': 'gradient-shift 8s ease infinite',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-neon': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(143, 245, 255, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(143, 245, 255, 0.6), 0 0 80px rgba(143, 245, 255, 0.2)' },
        },
        'slide-up': {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        '34': '8.5rem',
        '38': '9.5rem',
        '42': '10.5rem',
        '46': '11.5rem',
        '50': '12.5rem',
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #8ff5ff 0%, #00eefc 50%, #a2f31f 100%)',
        'neon-gradient-radial': 'radial-gradient(ellipse at center, rgba(143, 245, 255, 0.15) 0%, transparent 70%)',
        'dark-gradient': 'linear-gradient(135deg, #0e0e0e 0%, #1a1a1a 100%)',
        'primary-gradient': 'linear-gradient(135deg, #8ff5ff 0%, #00eefc 100%)',
        'hero-gradient': 'linear-gradient(180deg, rgba(14, 14, 14, 0) 0%, rgba(14, 14, 14, 0.6) 40%, rgba(14, 14, 14, 0.95) 100%)',
      },
    },
  },
  plugins: [typography],
}
