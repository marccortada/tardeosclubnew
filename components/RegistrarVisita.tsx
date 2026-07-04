"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/** Registra una visita al tardeo (una sola vez por sesión de navegador). */
export default function RegistrarVisita({ tardeoId }: { tardeoId: string }) {
  useEffect(() => {
    if (!tardeoId) return;
    const clave = `visto-${tardeoId}`;
    try {
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, "1");
    } catch {
      // sin sessionStorage seguimos igualmente
    }
    supabase.rpc("incrementar_visita", { p_tardeo: tardeoId }).then(() => {}, () => {});
  }, [tardeoId]);

  return null;
}
