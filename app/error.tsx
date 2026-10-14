"use client";

import PantallaError from "@/components/PantallaError";

/**
 * Error en cualquier página (dentro del layout raíz: la cabecera sigue).
 * Next 16 pasa `retry` (vuelve a pedir y pintar) y `reset` (solo repinta);
 * se usa el primero que haya.
 */
export default function ErrorPagina({
  error, retry, reset,
}: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  return <PantallaError error={error} reintentar={retry ?? reset} />;
}
