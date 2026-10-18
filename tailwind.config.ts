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
  // Modo oscuro por clase: la pone el script de app/layout.tsx antes de pintar
  // (sin parpadeo) según la preferencia guardada.
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        magenta: {
          DEFAULT: "#D61AA8",
          // 50 y 100 son fondos tintados: van por variable para que en oscuro
          // sean un rosa hondo y no un rosa pastel con texto claro encima.
          50: "rgb(var(--c-magenta-50) / <alpha-value>)",
          100: "rgb(var(--c-magenta-100) / <alpha-value>)",
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
        // Los neutros van por variables CSS (app/globals.css): claro y oscuro
        // en un solo sitio. En claro valen lo mismo que antes.
        tinta: { DEFAULT: "rgb(var(--c-tinta) / <alpha-value>)", suave: "rgb(var(--c-tinta-suave) / <alpha-value>)" },
        // Fondos: `marfil` ahora es un neutro casi blanco, no crema.
        marfil: {
          DEFAULT: "rgb(var(--c-marfil) / <alpha-value>)",
          100: "rgb(var(--c-marfil-100) / <alpha-value>)",
          200: "rgb(var(--c-marfil-200) / <alpha-value>)",
        },
        // Fijos, NO cambian con el tema:
        // - `noche`: fondo oscuro de marca (pie, cabecera de ficha, huecos de
        //   foto). Con bg-tinta, en oscuro se volvía casi blanco con texto blanco.
        // - `sobre-oro`: el texto encima del oro. El oro es igual en los dos
        //   temas, así que su texto ha de ser siempre oscuro (text-tinta se
        //   aclaraba en oscuro: 1,4:1).
        noche: "rgb(var(--c-noche) / <alpha-value>)",
        "sobre-oro": "rgb(var(--c-sobre-oro) / <alpha-value>)",
        // Tarjetas y página (v2). Usar estos y no bg-white en lo nuevo.
        superficie: "rgb(var(--c-superficie) / <alpha-value>)",
        fondo: "rgb(var(--c-fondo) / <alpha-value>)",
        // Bordes y separadores.
        linea: { DEFAULT: "rgb(var(--c-linea) / <alpha-value>)", fuerte: "rgb(var(--c-linea-fuerte) / <alpha-value>)" },
        // Estados. El color base es FIJO (sirve de fondo de botón con texto blanco
        // en los dos temas); su uso como TEXTO se aclara en oscuro desde
        // globals.css. Los fondos suaves (`*-fondo`) van por variable: en oscuro
        // eran cajas crema con letra clara encima y no se leía nada.
        ok: { DEFAULT: "#15803D", fondo: "rgb(var(--c-ok-fondo) / <alpha-value>)" },
        aviso: { DEFAULT: "#8A5A00", fondo: "rgb(var(--c-aviso-fondo) / <alpha-value>)" },
        error: { DEFAULT: "#B91C3C", fondo: "rgb(var(--c-error-fondo) / <alpha-value>)" },
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
