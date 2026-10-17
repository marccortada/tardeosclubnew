"use client";

import { useMemo, useState } from "react";
import MapaClient from "@/components/MapaClient";
import { mismaZona, zonasDe } from "@/lib/zonas";
import { Tardeo } from "@/lib/types";
import Link from "next/link";
import { X, Bell, ArrowRight } from "lucide-react";
import { hoyEnEspana, diasEntre, diaDeLaSemana } from "@/lib/fechas";


const CUANDOS = [
  { k: "hoy", label: "Hoy" },
  { k: "finde", label: "Este finde" },
  { k: "semana", label: "Esta semana" },
];

/** Mismo criterio que el listado y la portada, en hora de España. */
function enRango(fecha: string, cuando: string | null) {
  if (!cuando) return true;
  const hoy = hoyEnEspana();
  const dias = diasEntre(hoy, fecha);
  if (cuando === "hoy") return dias === 0;
  if (cuando === "semana") return dias >= 0 && dias <= 7;
  if (cuando === "finde") {
    const dow = diaDeLaSemana(fecha);
    const hastaDomingo = (7 - diaDeLaSemana(hoy)) % 7;
    return dias >= 0 && dias <= hastaDomingo && (dow === 5 || dow === 6 || dow === 0);
  }
  return true;
}

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`min-h-tacto shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[16px] font-semibold transition ${
        activo ? "border-magenta bg-magenta text-white" : "border-linea-fuerte bg-white text-tinta hover:border-magenta/50"
      }`}
    >
      {children}
    </button>
  );
}

export default function MapaFiltrable({ todos }: { todos: Tardeo[] }) {
  const [zona, setZona] = useState<string | null>(null);
  const [cuando, setCuando] = useState<string | null>(null);

  // Agrupadas (Barcelona, Maresme, Costa Brava…) en vez de una por municipio.
  const zonas = useMemo(() => zonasDe(todos).map((z) => z.zona), [todos]);

  const lista = useMemo(
    () => todos.filter((t) => (!zona || mismaZona(t.zona, zona)) && enRango(t.fecha, cuando)),
    [todos, zona, cuando]
  );

  const nFiltros = [zona, cuando].filter(Boolean).length;

  return (
    /* Alto exacto hasta la barra inferior (64 px + zona segura del iPhone) en el
       móvil, y hasta el pie de la ventana en escritorio: el mapa ocupa todo lo
       que queda sin que la barra le tape la parte de abajo. */
    <main className="mx-auto flex h-[calc(100dvh-64px-env(safe-area-inset-bottom))] max-w-6xl flex-col px-4 pb-3 pt-4 md:h-[calc(100dvh-72px)] md:px-8 md:pb-6 md:pt-8">
      <div className="mb-3 flex items-end gap-2">
        <h1 className="font-display text-[30px] font-bold leading-tight md:text-[42px]">Mapa de tardeos</h1>
        <span className="mb-1 ml-auto text-[15px] font-semibold text-tinta-suave">{lista.length} {lista.length === 1 ? "tardeo" : "tardeos"}</span>
      </div>

      {/* Sin cartelera no se enseña un mapa vacío con filtros que responden:
          se dice que no hay nada. Mismo motivo que en el listado — un mapa en
          blanco bajo una fila de filtros se lee como "el mapa está roto". */}
      {todos.length === 0 ? (
        /* El mapa de la costa se enseña igual, atenuado, con el aviso encima:
           así se ve que funciona y que lo que falta son fechas. */
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-linea">
          <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
            <MapaClient tardeos={[]} conZoom={false} />
          </div>
          <div className="absolute inset-0 z-[500] grid place-items-center bg-white/40 p-4">
            <div className="max-w-sm rounded-2xl border border-linea bg-white p-6 text-center shadow-elevada">
              <p className="text-xl font-bold">Ahora mismo no hay tardeos en el mapa</p>
              <p className="mt-2 text-[16px] text-tinta-suave">
                No hay ninguna fecha publicada de hoy en adelante. Activa los avisos y te contamos cuando salgan.
              </p>
              <Link href="/perfil/notificaciones" className="mt-4 inline-flex min-h-tacto w-full items-center justify-center gap-2 rounded-xl bg-oro-400 px-5 font-bold text-sobre-oro hover:bg-oro">
                <Bell size={19} aria-hidden /> Activar avisos
              </Link>
              <Link href="/colaboradores" className="mt-2 inline-flex min-h-tacto items-center gap-1 rounded-xl px-2 text-[15px] font-bold text-magenta-700 hover:bg-magenta-50">
                Ver locales y DJs <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Filtros. Aquí el carrusel sí toca: son todas las zonas y no caben de
          ninguna manera. Lo que faltaba era el degradado del borde, que es lo
          único que delata que la fila sigue más allá del canto de la pantalla. */}
      <div className="relative mb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CUANDOS.map((c) => (
            <Chip key={c.k} activo={cuando === c.k} onClick={() => setCuando((p) => (p === c.k ? null : c.k))}>
              {c.label}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 w-px shrink-0 bg-linea-fuerte" />
          {zonas.map((z) => (
            <Chip key={z} activo={zona === z} onClick={() => setZona((p) => (p === z ? null : z))}>
              {z}
            </Chip>
          ))}
          {nFiltros > 0 && (
            <button
              onClick={() => { setZona(null); setCuando(null); }}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl px-3 text-[15px] font-bold text-magenta-700 hover:bg-magenta-50"
            >
              <X size={16} aria-hidden /> Quitar
            </button>
          )}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-marfil to-transparent" />
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-linea">
        <MapaClient tardeos={lista} />
      </div>
      </>
      )}
    </main>
  );
}
