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
        // Keep legacy brand ramp (zinc) during migration
        brand: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
        // PRIMARY — trust + money-positive. Formalizes the app's emerald.
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // ACCENT — data-viz & informational only, never actions.
        accent: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        // SEMANTIC — single source of truth for states.
        success: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fff1f2',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
        },
        info: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7',
        },
      },
      fontSize: {
        // Explicit scale — replaces ad-hoc text-[9px]/[10px]/[11px]
        '2xs': ['11px', { lineHeight: '16px' }],
        'xs': ['12px', { lineHeight: '18px' }],
        'sm': ['13px', { lineHeight: '20px' }],
        'base': ['14px', { lineHeight: '22px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['18px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '38px' }],
      },
      fontFamily: {
        // Inter Variable — self-hosted so the offline PWA shell keeps its type.
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Numbers: tabular alignment without monospace's visual noise.
        numeric: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        // Elevation ladder — dark mode relies on borders, not shadows.
        xs: '0 1px 2px 0 rgb(9 9 11 / 0.05)',
        sm: '0 1px 3px 0 rgb(9 9 11 / 0.08), 0 1px 2px -1px rgb(9 9 11 / 0.06)',
        md: '0 4px 12px -2px rgb(9 9 11 / 0.10)',
        lg: '0 12px 32px -8px rgb(9 9 11 / 0.18)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
