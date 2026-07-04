import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta de marca TardeosClub (extraída del logo real)
        magenta: {
          DEFAULT: "#E10A5A",
          50: "#FDE7F0",
          100: "#FBC5DA",
          400: "#EE3E80",
          500: "#E10A5A",
          600: "#C00040",
          700: "#9A0033",
        },
        oro: {
          DEFAULT: "#F5B301",
          400: "#FBC63A",
          500: "#F5B301",
          600: "#E0A000",
        },
        tinta: "#2A1721", // texto oscuro cálido
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
        script: ["var(--font-caveat)", "cursive"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        tarjeta: "0 6px 24px -8px rgba(225,10,90,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
