/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        xdc: {
          blue: '#1c4ed8',
          dark: '#0a0a0a',
          card: '#141414',
          border: '#262626',
          accent: '#3b82f6',
          text: '#e5e5e5',
          muted: '#737373',
        },
      },
    },
  },
  plugins: [],
}
