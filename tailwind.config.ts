import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./services/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#082033",
        medical: "#116D9D",
        deep: "#071726",
        silver: "#D8E2EA"
      },
      boxShadow: {
        premium: "0 24px 70px rgba(8, 32, 51, 0.12)",
        glass: "0 18px 55px rgba(17, 109, 157, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
