import { ReactNode } from "react";

/** Contenedor base: blanco, borde neutro, sombra sutil. */
export default function Tarjeta({
  children, className = "", relleno = true,
}: { children: ReactNode; className?: string; relleno?: boolean }) {
  return (
    <div className={`rounded-2xl border border-linea bg-white shadow-tarjeta ${relleno ? "p-4 md:p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}
