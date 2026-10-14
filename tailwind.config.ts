import type { Config } from "tailwindcss";

/**
 * Sistema visual de TardeosClub (rediseño oct-2026, v3).
 *
 * Es el de tardeosclub.com —el que reconoce la gente— pero mejorado: rosa
 * neón de fiesta, oro, degradado rosa→naranja, fondo blanco; titulares en
 * Manrope, y frases cortas de ambiente en Dancing Script.
 * Lo que se mejora: el contraste (blanco sobre el rosa neón original no llega
 * a 3:1; el `magenta` de los botones es un punto más profundo), la escala de
 * tamaños y el orden. El neón original queda como `magenta-400`.
 *
 * Los nombres de token se mantienen (magenta, oro, tinta, marfil…) para no
 * tocar cien ficheros: cambia el valor, no el nombre.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        magenta: {
          DEFAULT: "#D61AA8",
          50: "#FFF0FB",
          100: "#FFD9F4",
          400: "#FF3DCF",
          500: "#E520B5",
          600: "#BD1592",
          700: "#930E72",
        },
        oro: {
          DEFAULT: "#FAC72E",
          400: "#FFD24D",
          500: "#FAC72E",
          600: "#E0A800",
        },
        naranja: { DEFAULT: "#F97316", 400: "#FB923C" },
        // Texto: casi negro cálido y un gris legible (≥7:1 sobre el fondo).
        tinta: { DEFAULT: "#1A1A1A", suave: "#555555" },
        // Fondos: `marfil` ahora es un neutro casi blanco, no crema.
        marfil: { DEFAULT: "#FAFAFA", 100: "#F4F4F5", 200: "#E9E9EC" },
        // Bordes y separadores.
        linea: { DEFAULT: "#E5E5E5", fuerte: "#D4D4D8" },
        ok: { DEFAULT: "#15803D", fondo: "#E8F6EE" },
        aviso: { DEFAULT: "#8A5A00", fondo: "#FFF4D6" },
        error: { DEFAULT: "#B91C3C", fondo: "#FDECEF" },
      },
      minHeight: { tacto: "3rem" }, // 48 px: lo mínimo que se acierta con el pulgar
      minWidth: { tacto: "3rem" },
      fontFamily: {
        // Manrope para todo (texto y titulares); Dancing Script solo de acento.
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "system-ui", "sans-serif"],
        // Solo para frases cortas de ambiente, nunca para información.
        script: ["var(--font-dancing)", "cursive"],
      },
      // `black` (900) cae en 800 y `extrabold` en 700: con 900 en todas
      // partes la interfaz gritaba.
      fontWeight: {
        black: "800",
        extrabold: "700",
      },
      borderRadius: {
        xl2: "1.25rem",
        "2xl": "0.875rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        tarjeta: "0 1px 2px rgba(24,18,26,0.04), 0 2px 8px -2px rgba(24,18,26,0.06)",
        elevada: "0 4px 6px -2px rgba(24,18,26,0.05), 0 12px 24px -6px rgba(24,18,26,0.12)",
        // Los antiguos relieves "plastilina" pasan a ser planos.
        plastilina: "0 1px 2px rgba(214,26,168,0.25)",
        brillo: "0 0 30px rgba(255,61,207,0.35), 0 0 60px rgba(250,199,46,0.18)",
        "plastilina-oro": "0 1px 2px rgba(180,120,0,0.25)",
        "plastilina-pulsado": "none",
      },
    },
  },
  plugins: [],
};

export default config;
