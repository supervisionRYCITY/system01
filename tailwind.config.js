/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './partials/**/*.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      fontFamily: { sarabun: ['Sarabun', 'sans-serif'] },
      colors: {
        navy: { DEFAULT: '#0E3B5C', dark: '#092A42', light: '#15537D' },
        gold: { DEFAULT: '#C08A2E', light: '#E0B563', pale: '#F5E9D2' },
        teal: { DEFAULT: '#0F6E56', light: '#DCEEE8' },
        paper: '#F7F6F2',
        ink: '#1F2A33',
        line: '#E2DFD6',
      },
    },
  },
  plugins: [],
};
