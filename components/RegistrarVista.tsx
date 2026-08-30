"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { medir } from "@/lib/metricas";

/**
 * Cuenta que alguien ha abierto esta ficha. Una vez por pestaña.
 *
 * Sustituye al antiguo RegistrarVisita, que solo servía para tardeos y solo
 * sumaba a un contador sin fecha. Ahora vale para tardeo, local y DJ, y guarda
 * cuándo pasó, que es lo que permite comparar meses y enseñar evolución.
 *
 * Sigue llamando al contador viejo cuando es un tardeo: el panel del local
 * todavía lo lee, y quitarlo antes de cambiar el panel dejaría a los locales
 * viendo cero visitas de un día para otro.
 */
export default function RegistrarVista({
  tipo,
  id,
}: {
  tipo: "tardeo" | "local" | "dj";
  id: string;
}) {
  useEffect(() => {
    if (!id) return;
    const refs =
      tipo === "tardeo" ? { tardeoId: id } : tipo === "local" ? { localId: id } : { djId: id };
    medir(`vista_${tipo}` as const, refs, { unaVezPorSesion: true });

    if (tipo === "tardeo") {
      try {
        const k = `visto-${id}`;
        if (!sessionStorage.getItem(k)) {
          sessionStorage.setItem(k, "1");
          supabase.rpc("incrementar_visita", { p_tardeo: id }).then(() => {}, () => {});
        }
      } catch { /* sin sessionStorage se cuenta igual */ }
    }
  }, [tipo, id]);

  return null;
}
