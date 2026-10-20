"use client";

import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Ventana emergente accesible. En móvil sube desde abajo (se alcanza con el
 * pulgar); en escritorio es un diálogo centrado. Cierra con Escape, con el
 * fondo o con la X (48 px). Bloquea el scroll de detrás, no deja que el foco
 * salga con Tab y lo devuelve al cerrar. Alto en dvh: con vh, en el móvil la
 * barra del navegador tapaba el pie (los botones de confirmar).
 */
export default function Hoja({
  abierta, onCerrar, titulo, children, pie,
}: { abierta: boolean; onCerrar: () => void; titulo: string; children: ReactNode; pie?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // onCerrar suele llegar como función inline (nueva en cada render). Si el
  // efecto dependiera de ella, se re-ejecutaría en cada tecla y devolvería el
  // foco al diálogo, robándoselo al input que se está escribiendo.
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);

  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { cerrarRef.current(); return; }
      // Trampa de foco: con Tab el foco no sale de la hoja. Sin esto, quien usa
      // teclado o lector de pantalla acababa en la página de detrás (tapada).
      if (e.key !== "Tab" || !ref.current) return;
      const focos = Array.from(ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((el) => el.offsetParent !== null);
      if (!focos.length) { e.preventDefault(); return; }
      const primero = focos[0], ultimo = focos[focos.length - 1];
      const dentro = ref.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === primero || !dentro)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) { e.preventDefault(); primero.focus(); }
    };
    window.addEventListener("keydown", tecla);
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, [abierta]);

  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-noche/60 backdrop-blur-[2px]" onClick={onCerrar} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-elevada outline-none sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-linea px-5 py-3">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="grid min-h-tacto min-w-tacto place-items-center rounded-full text-tinta hover:bg-marfil-100">
            <X size={24} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="border-t border-linea px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{pie}</div>}
      </div>
    </div>
  );
}
