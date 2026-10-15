/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0f172a', light: '#1e293b' },
        brand: { DEFAULT: '#2563eb', dark: '#1d4ed8', soft: '#eef2ff' },
      },
    },
  },
  plugins: [],
};
