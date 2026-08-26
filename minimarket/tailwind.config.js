/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74",
          400: "#fb923c", 500: "#f97316", 600: "#ea6a0a", 700: "#c2570a",
          800: "#9a4510", 900: "#7c3a11", 950: "#431d06"
        }
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] }
    }
  },
  plugins: []
};
