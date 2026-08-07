import { createClient } from "@supabase/supabase-js";

// Tiempo máximo de espera por consulta. Sin esto, si Supabase no responde
// (caído, DNS roto, red lenta) las páginas que consultan en servidor se quedan
// colgadas hasta que el sistema operativo corta la conexión, que pueden ser
// 7-8 segundos. El visitante ve una página en blanco y se piensa que está rota.
//
// Una consulta sana tarda menos de 300 ms, así que 2,5 s da margen de sobra y
// a la vez garantiza que la página siempre responde rápido aunque la base de
// datos no esté. Ajustable con SUPABASE_TIMEOUT_MS si hiciera falta.
const TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS ?? 2500);

/** Cliente público (anon). Vale para lectura pública en server y cliente. */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }),
    },
  }
);
