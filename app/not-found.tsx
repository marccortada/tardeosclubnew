import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, Home, SearchX } from "lucide-react";
import { claseBoton } from "@/components/Boton";

export const metadata: Metadata = {
  title: "Página no encontrada · TardeosClub",
  robots: { index: false },
};

/**
 * 404 de toda la app. Sin esto salía el de Next, en inglés y sin salida.
 * Mensaje corto y dos caminos claros: el Inicio y la lista de eventos.
 * También lo usan las fichas que no existen o no son públicas (notFound()).
 */
export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center bg-fondo px-4 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-magenta-50 text-magenta">
        <SearchX size={32} aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight md:text-[28px]">No encontramos esta página</h1>
      <p className="mt-2 text-[16px] text-tinta-suave">
        Puede que el enlace esté mal o que ya no exista.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/" className={claseBoton("primario")}>
          <Home size={18} aria-hidden /> Ir al inicio
        </Link>
        <Link href="/eventos" className={claseBoton("contorno")}>
          <CalendarDays size={18} aria-hidden /> Ver eventos
        </Link>
      </div>
    </main>
  );
}
