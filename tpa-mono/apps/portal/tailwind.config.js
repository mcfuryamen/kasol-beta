/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html','./src/**/*.{ts,tsx}','../../packages/shared/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { 50:'#fff7ed',100:'#ffedd5',500:'#ea580c',600:'#dc2626',700:'#c2410c',800:'#9a3412' } },
    },
  },
  plugins: [],
};
