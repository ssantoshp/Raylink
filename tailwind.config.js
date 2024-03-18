
/** @type {import('tailwindcss/tailwind-config').TailwindConfig} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    fontFamily: {
      sans: ["Inter", "sans-serif"]
    }
  },
  variants: { extend: { typography: ["dark"] } },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")]
}