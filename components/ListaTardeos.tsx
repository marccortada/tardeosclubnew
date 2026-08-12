"use client";

import { useEffect, useState } from "react";
import TardeoCard from "@/components/TardeoCard";
import { ESTILOS } from "@/lib/mockData";
import { zonaGrande, zonasDe } from "@/lib/zonas";
import { useUbicacion } from "@/lib/ubicacion";
import { distanciaKm } from "@/lib/geo";
import { Tardeo } from "@/lib/types";
import { SlidersHorizontal, X, Loader2, Search, Navigation } from "lucide-react";

const CUANDOS = [
  { k: "hoy", label: "Hoy" },
  { k: "finde", label: "Este finde" },
  { k: "semana", label: "Esta semana" },
];

type Filtro = { zona: string | null; estilo: string | null; tipo: string | null };

const TIPOS = [
  { k: "gratis", label: "Gratis" },
  { k: "pago", label: "Entrada" },
  { k: "lista", label: "Por lista" },
];

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-extrabold transition ${
        activo
          ? "bg-magenta text-white"
          : "bg-white text-tinta/80 ring-1 ring-magenta-100 hover:ring-magenta"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * El listado con sus filtros.
 *
 * Los tardeos llegan ya cargados del servidor (`todos`) en vez de pedirlos al
 * montar. Antes esta página era cliente entera y su HTML salía sin una sola
 * ficha: el buscador veía el título, los filtros y un "Cargando tardeos…".
 * Para la página que más tráfico debería traer, eso es no existir.
 *
 * Por lo mismo no se usa `useSearchParams` para leer ?zona=: ese hook saca la
 * página del renderizado de servidor y volveríamos justo a lo de antes. Se lee
 * al montar, que es cuando se llega desde "Explora por zona".
 */
export default function ListaTardeos({ todos }: { todos: Tardeo[] }) {
  const [f, setF] = useState<Filtro>({ zona: null, estilo: null, tipo: null });
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [cuando, setCuando] = useState<string | null>(null);
  const { coords, estado: estadoUbi, pedir: pedirUbicacion } = useUbicacion();

  /** Distancia del tardeo a donde estás, o null si le faltan coordenadas. */
  const distanciaDe = (t: Tardeo) =>
    coords && t.lat && t.lng ? distanciaKm(coords, { lat: t.lat, lng: t.lng }) : null;

  useEffect(() => {
    const zona = new URLSearchParams(window.location.search).get("zona");
    if (zona) setF((p) => ({ ...p, zona }));
  }, []);

  const set = (k: keyof Filtro, v: string) => setF((p) => ({ ...p, [k]: p[k] === v ? null : v }));

  // Agrupadas (Barcelona, Maresme, Costa Brava…) en vez de una por municipio.
  const zonasDisponibles = zonasDe(todos).map((z) => z.zona);

  // --- Búsqueda por texto (título, local, zona, estilo, DJ) ---
  const coincideTexto = (t: Tardeo) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      t.titulo.toLowerCase().includes(s) ||
      t.local.nombre.toLowerCase().includes(s) ||
      t.zona.toLowerCase().includes(s) ||
      (t.estilo || "").toLowerCase().includes(s) ||
      t.djs.some((d) => (d.nombre || "").toLowerCase().includes(s))
    );
  };

  // --- Filtro rápido de fecha (Hoy / Este finde / Esta semana) ---
  const enRango = (t: Tardeo) => {
    if (!cuando) return true;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = new Date(t.fecha + "T00:00:00");
    const dias = Math.round((d.getTime() - hoy.getTime()) / 86400000);
    if (cuando === "hoy") return dias === 0;
    if (cuando === "semana") return dias >= 0 && dias <= 7;
    if (cuando === "finde") {
      const dow = d.getDay(); // 0 dom, 5 vie, 6 sab
      return dias >= 0 && dias <= 7 && (dow === 5 || dow === 6 || dow === 0);
    }
    return true;
  };

  const filtrados = todos.filter(
    (t) =>
      (!f.zona || zonaGrande(t.zona) === f.zona) &&
      (!f.estilo || t.estilo === f.estilo) &&
      (!f.tipo || t.tipoEntrada === f.tipo) &&
      coincideTexto(t) &&
      enRango(t)
  );

  /**
   * Con la ubicación puesta, manda la cercanía: si estás en Mataró lo primero
   * que quieres ver es lo que tienes al lado, no lo que pasa antes en el
   * calendario. Sin ubicación se mantiene el orden por fecha de siempre.
   *
   * Los que no tienen coordenadas se van al final en vez de colarse arriba.
   */
  const lista = coords
    ? [...filtrados].sort((a, b) => (distanciaDe(a) ?? Infinity) - (distanciaDe(b) ?? Infinity))
    : filtrados;

  const nFiltros = [f.zona, f.estilo, f.tipo].filter(Boolean).length;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-5 md:px-8 md:pt-8">
      <div className="mb-3">
        <p className="font-script text-xl leading-none text-magenta-600 md:text-2xl">Encuentra tu sitio</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-black leading-tight md:text-3xl">
            {f.zona ? `Tardeos en ${f.zona}` : "Conecta con tu tardeo"}
          </h1>
          <button
            onClick={() => setAbierto((v) => !v)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-marca px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-105"
          >
            <SlidersHorizontal size={18} /> Filtrar {nFiltros > 0 && `(${nFiltros})`}
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative mb-3">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta/40" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca por nombre, DJ, local o zona…"
          className="w-full rounded-2xl border-2 border-magenta-100 bg-white py-3.5 pl-12 pr-4 text-base font-semibold outline-none transition focus:border-magenta"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Borrar" className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-tinta/40 hover:bg-black/5">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Chips rápidos de fecha */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {CUANDOS.map((c) => (
          <button
            key={c.k}
            onClick={() => setCuando((p) => (p === c.k ? null : c.k))}
            className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-sm font-extrabold transition ${
              cuando === c.k ? "bg-magenta text-white" : "bg-white text-tinta/80 ring-1 ring-magenta-100 hover:ring-magenta"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Filtros activos visibles */}
      {nFiltros > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[f.zona, f.estilo, f.tipo].filter(Boolean).map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-magenta-50 px-3 py-1.5 text-sm font-extrabold text-magenta-700">
              {v}
            </span>
          ))}
          <button
            onClick={() => setF({ zona: null, estilo: null, tipo: null })}
            className="inline-flex items-center gap-1 text-sm font-bold text-magenta"
          >
            <X size={14} /> Quitar filtros
          </button>
        </div>
      )}

      {abierto && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
          <p className="mb-1.5 text-sm font-black text-tinta/60">Zona</p>
          <div className="flex flex-wrap gap-2">
            {zonasDisponibles.map((z) => (
              <Chip key={z} activo={f.zona === z} onClick={() => set("zona", z)}>{z}</Chip>
            ))}
          </div>

          <p className="mb-1.5 mt-3 text-sm font-black text-tinta/60">Estilo</p>
          <div className="flex flex-wrap gap-2">
            {ESTILOS.map((e) => (
              <Chip key={e} activo={f.estilo === e} onClick={() => set("estilo", e)}>{e}</Chip>
            ))}
          </div>

          <p className="mb-1.5 mt-3 text-sm font-black text-tinta/60">Entrada</p>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <Chip key={t.k} activo={f.tipo === t.k} onClick={() => set("tipo", t.k)}>{t.label}</Chip>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-tinta/60">
          {lista.length} tardeos{coords && " · los más cercanos primero"}
        </p>
        {/* El permiso se pide con un gesto, no al entrar: el navegador solo
            enseña el diálogo si lo dispara el usuario. */}
        {!coords && estadoUbi !== "no-soportada" && (
          <button
            onClick={pedirUbicacion}
            disabled={estadoUbi === "pidiendo"}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-black text-magenta shadow-tarjeta ring-1 ring-magenta-100 disabled:opacity-50"
          >
            {estadoUbi === "pidiendo"
              ? <Loader2 size={14} className="animate-spin" />
              : <Navigation size={14} />}
            Ver los más cercanos
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {lista.map((t) => (
          <TardeoCard key={t.id} tardeo={t} distanciaKm={distanciaDe(t)} />
        ))}
      </div>
      {lista.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/60 ring-1 ring-magenta-100">
          {todos.length === 0 ? "Aún no hay tardeos publicados. ¡Vuelve pronto! 🎉" : "No hay tardeos con esos filtros 😅"}
        </p>
      )}
    </main>
  );
}
