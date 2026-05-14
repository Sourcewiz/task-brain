/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        p0: { light: '#FED7D7', DEFAULT: '#E53E3E', dark: '#C53030' },
        p1: { light: '#FEEBC8', DEFAULT: '#DD6B20', dark: '#C05621' },
        p2: { light: '#E2E8F0', DEFAULT: '#718096', dark: '#4A5568' },
        backlog: { light: '#F7FAFC', DEFAULT: '#A0AEC0', dark: '#718096' },
      }
    }
  },
  plugins: [],
}