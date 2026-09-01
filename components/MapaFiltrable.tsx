"use client";

import { useMemo, useState } from "react";
import MapaClient from "@/components/MapaClient";
import { mismaZona, zonasDe } from "@/lib/zonas";
import { Tardeo } from "@/lib/types";
import { MapPin, X } from "lucide-react";


const CUANDOS = [
  { k: "hoy", label: "Hoy" },
  { k: "finde", label: "Este finde" },
  { k: "semana", label: "Esta semana" },
];

function enRango(fecha: string, cuando: string | null) {
  if (!cuando) return true;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const d = new Date(fecha + "T00:00:00");
  const dias = Math.round((d.getTime() - hoy.getTime()) / 86400000);
  if (cuando === "hoy") return dias === 0;
  if (cuando === "semana") return dias >= 0 && dias <= 7;
  if (cuando === "finde") {
    const dow = d.getDay();
    return dias >= 0 && dias <= 7 && (dow === 5 || dow === 6 || dow === 0);
  }
  return true;
}

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[40px] whitespace-nowrap rounded-full px-4 py-2 text-sm font-extrabold transition ${
        activo ? "bg-magenta text-white" : "bg-white text-tinta/80 ring-1 ring-magenta-100 hover:ring-magenta"
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
    <main className="mx-auto flex h-[calc(100vh-140px)] max-w-6xl flex-col px-4 pt-6 md:h-[calc(100vh-150px)] md:px-8">
      <div className="mb-2 flex items-center gap-2">
        <MapPin className="text-magenta" />
        <h1 className="font-display text-2xl font-black md:text-4xl">Mapa de tardeos</h1>
        <span className="ml-auto text-sm font-bold text-tinta/50">{lista.length} {lista.length === 1 ? "tardeo" : "tardeos"}</span>
      </div>

      {/* Sin cartelera no se enseña un mapa vacío con filtros que responden:
          se dice que no hay nada. Mismo motivo que en el listado — un mapa en
          blanco bajo una fila de filtros se lee como "el mapa está roto". */}
      {todos.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl bg-white p-8 text-center ring-1 ring-magenta-100">
          <div>
            <p className="font-display text-xl font-black">Todavía no hay tardeos que poner en el mapa</p>
            <p className="mx-auto mt-2 max-w-sm font-semibold text-tinta/60">
              No es el mapa ni los filtros: no hay ningún tardeo con fecha de hoy en adelante.
            </p>
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
          <span className="mx-1 w-px shrink-0 bg-magenta-100" />
          {zonas.map((z) => (
            <Chip key={z} activo={zona === z} onClick={() => setZona((p) => (p === z ? null : z))}>
              {z}
            </Chip>
          ))}
          {nFiltros > 0 && (
            <button
              onClick={() => { setZona(null); setCuando(null); }}
              className="inline-flex shrink-0 items-center gap-1 px-2 text-sm font-bold text-magenta"
            >
              <X size={14} /> Quitar
            </button>
          )}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#f5f3f4] to-transparent" />
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl ring-1 ring-magenta-100">
        <MapaClient tardeos={lista} />
      </div>
      </>
      )}
    </main>
  );
}
