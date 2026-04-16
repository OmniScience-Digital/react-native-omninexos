/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["sans-regular"],
        "sans-bold": ["sans-bold"],
        "sans-medium": ["sans-medium"],
        "sans-semibold": ["sans-semibold"],
        "sans-extrabold": ["sans-extrabold"],
        "sans-light": ["sans-light"],
      },
    },
  },
  plugins: [],
};
