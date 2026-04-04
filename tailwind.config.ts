import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#e0521d',
        'primary-dark': '#c7461a',
        'primary-light': '#f5d9cc',
        dark: '#161616',
        'gray-50': '#F8FAFC',
        'gray-100': '#F1F5F9',
        'gray-200': '#E2E8F0',
        'gray-300': '#CBD5E1',
        'gray-400': '#94A3B8',
        'gray-500': '#64748B',
        'gray-600': '#475569',
        'gray-700': '#334155',
        'gray-800': '#1E293B',
        'gray-900': '#0F172A',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          "'Segoe UI'",
          'Roboto',
          "'Helvetica Neue'",
          'Arial',
          "'sans-serif'",
        ],
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}

export default config
