"use client";

import { useEffect } from "react";
import { enviarError } from "@/lib/erroresCliente";

/**
 * Escucha los errores que nadie captura en el navegador (un botón que revienta,
 * una promesa rechazada sin `catch`) y los manda a /admin/errores. No pinta
 * nada. Los errores de render los recogen app/error.tsx y global-error.tsx.
 */
export default function CapturaErrores() {
  useEffect(() => {
    const alError = (ev: ErrorEvent) => {
      // Un recurso roto (imagen, script) también dispara 'error' pero sin
      // mensaje ni objeto: eso no es un fallo de código.
      if (!ev.error && !ev.message) return;
      void enviarError(ev.error ?? ev.message, ev.filename);
    };
    const alRechazo = (ev: PromiseRejectionEvent) => void enviarError(ev.reason);
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, []);
  return null;
}
