/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        transit: {
          dark: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          primary: '#2563eb',
          accent: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          oficial: '#10b981',
          costumbre: '#f59e0b',
          base: '#8b5cf6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
