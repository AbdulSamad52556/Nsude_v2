import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette: Deep Black, Off White (paper), Stone Grey (ash),
        // Taupe and the Sand Beige accent.
        ink: "#000000",
        charcoal: "#161615",
        graphite: "#3a3a38",
        stone: "#8a8a84",
        ash: "#6e6e6e", // Stone Grey
        mist: "#c9c7c0",
        bone: "#f4f1ea",
        paper: "#f8f6f1",
        rust: "#8a5a3f",
        taupe: "#a89f94",
        sand: "#d9c9b8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["var(--font-archivo)", "Helvetica Neue", "Arial", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.06em",
        tighter: "-0.03em",
        widest2: "0.28em",
      },
      fontSize: {
        "display-xl": ["clamp(3.5rem, 9vw, 9rem)", { lineHeight: "0.92", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.5rem, 6vw, 5.5rem)", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.75rem, 3.5vw, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        "fade-in": "fadeIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
