import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        moya: {
          dark: "#06060a",
          card: "#10101a",
          border: "#1e1e2a",
          red: "#e11d48",
          "red-deep": "#9f1239",
          "red-light": "#fb7185",
          green: "#059669",
          "green-deep": "#065f46",
          "green-light": "#34d399",
          violet: "#a855f7",
          "violet-light": "#c084fc",
          gold: "#eab308",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      animation: {
        "float-badge": "float-badge 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
        "spin-slow": "spin-slow 12s linear infinite",
        "slide-up": "slide-up 0.6s ease-out forwards",
        "count-bounce": "count-up-bounce 0.6s ease-out forwards",
        "banner-scroll": "banner-scroll 4s linear infinite",
      },
      keyframes: {
        "float-badge": {
          "0%, 100%": { transform: "translateY(0) rotate(-2deg)" },
          "50%": { transform: "translateY(-6px) rotate(1deg)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.05)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "count-up-bounce": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "60%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "banner-scroll": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
