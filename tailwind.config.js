/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Pila de fuentes SF Pro (Apple) con fallbacks cross-platform.
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      // Tokens semánticos que apuntan a variables CSS.
      // Formato rgb(var(--x) / <alpha-value>) habilita modificadores de opacidad
      // de Tailwind (p.ej. bg-surface/50).
      colors: {
        surface:    'rgb(var(--color-surface)   / <alpha-value>)',
        canvas:     'rgb(var(--color-surface-2) / <alpha-value>)',
        fg:         'rgb(var(--color-fg)        / <alpha-value>)',
        muted:      'rgb(var(--color-muted)     / <alpha-value>)',
        primary:    'rgb(var(--color-primary)   / <alpha-value>)',
        success:    'rgb(var(--color-success)   / <alpha-value>)',
        danger:     'rgb(var(--color-danger)    / <alpha-value>)',
        warning:    'rgb(var(--color-warning)   / <alpha-value>)',
      },
      // Sombras suaves tipo Apple: difusas, baja opacidad.
      boxShadow: {
        soft: '0 1px 3px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06)',
        card: '0 2px 8px rgb(0 0 0 / 0.06), 0 16px 40px rgb(0 0 0 / 0.08)',
        pop:  '0 4px 16px rgb(0 0 0 / 0.10), 0 24px 64px rgb(0 0 0 / 0.12)',
      },
      // Blur extra pequeño para glassmorphism sutil.
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
