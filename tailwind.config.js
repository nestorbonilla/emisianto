/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "celo-green": "#35D07F",
        "celo-gold": "#FBCC5C",
        "celo-dark": "#111214",
        "red": "#FB7C6D",
        "faint-gold": "#FEF2D6",
        "faint-gray": "#F8F9F9"
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
