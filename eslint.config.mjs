// eslint-config-next 16 ya exporta configuración plana, así que se importa
// directa. Nada de FlatCompat: con esa versión el puente revienta al validar.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      ".claude/**",       // las skills traen su propio código, no es nuestro
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Estas dos salían 51 veces en código que ya estaba escrito. Dejarlas
      // como error convierte `npm run lint` en un muro rojo permanente, y un
      // lint que siempre falla no lo ejecuta nadie: así, un error nuevo
      // significa algo que acabas de romper.
      //
      // `any`: son filas de Supabase. La solución de verdad es generar los
      // tipos (`supabase gen types typescript`) y entonces volver a ponerlo
      // en "error". Mientras tanto, aviso.
      "@typescript-eslint/no-explicit-any": "warn",
      // setState síncrono dentro de un efecto. Aparece en 13 sitios, casi
      // todos al resetear estado cuando no hay sesión. No rompe nada hoy,
      // pero provoca renders en cascada y conviene ir limpiándolo.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
