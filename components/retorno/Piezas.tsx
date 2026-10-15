"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Star } from "lucide-react";

/** Cabecera de pantalla de app: volver · título centrado (como el vídeo). */
export function CabeceraApp({ titulo, volver = "/" }: { titulo: string; volver?: string }) {
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[48px_1fr_48px] items-center border-b border-linea bg-white/95 px-2 py-2 backdrop-blur">
      <Link href={volver} aria-label="Volver" className="grid h-11 w-11 place-items-center rounded-full hover:bg-marfil-100">
        <ChevronLeft size={24} aria-hidden />
      </Link>
      <h1 className="truncate text-center text-[18px] font-bold">{titulo}</h1>
      <span />
    </header>
  );
}

/** Chip seleccionable con el estilo de la app (activo: fondo magenta-50). */
export function ChipSel({ children, activo, onClick }: { children: ReactNode; activo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-[15px] font-semibold transition-colors ${
        activo ? "border-magenta/30 bg-magenta-50 text-magenta-700" : "border-linea bg-marfil-100 text-tinta-suave hover:text-tinta"}`}>
      {children}
    </button>
  );
}

/** Estrellas 1‑5 pulsables (44 px cada una). */
export function Estrellas({ valor, onCambiar }: { valor: number; onCambiar?: (n: number) => void }) {
  return (
    <div className="flex gap-1" role={onCambiar ? "radiogroup" : undefined} aria-label="Tu valoración">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= valor;
        const ic = <Star size={30} className={on ? "fill-oro text-oro" : "text-linea-fuerte"} aria-hidden />;
        return onCambiar ? (
          <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} de 5`}
            onClick={() => onCambiar(n)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-marfil-100">{ic}</button>
        ) : <span key={n}>{ic}</span>;
      })}
    </div>
  );
}

/** Tarjeta de mensaje de estado (fuera de plazo, sin plaza…). */
export function Mensaje({ icono, titulo, children }: { icono: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-linea bg-white p-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-magenta-50 text-magenta">{icono}</span>
      <h2 className="text-xl font-bold">{titulo}</h2>
      {children && <div className="text-[16px] text-tinta-suave">{children}</div>}
    </div>
  );
}
