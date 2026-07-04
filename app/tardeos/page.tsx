"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TardeoCard from "@/components/TardeoCard";
import { ESTILOS } from "@/lib/mockData";
import { getTardeosPublicados } from "@/lib/tardeos";
import { Tardeo } from "@/lib/types";
import { SlidersHorizontal, X, Loader2, Search } from "lucide-react";

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

function TardeosContent() {
  const params = useSearchParams();
  const zonaParam = params.get("zona");

  const [f, setF] = useState<Filtro>({ zona: zonaParam, estilo: null, tipo: null });
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [cuando, setCuando] = useState<string | null>(null);
  const [todos, setTodos] = useState<Tardeo[]>([]);
  const [cargando, setCargando] = useState(true);

  // Cargar tardeos desde Supabase (con fallback a mock)
  useEffect(() => {
    getTardeosPublicados().then((t) => { setTodos(t); setCargando(false); });
  }, []);

  // Si llega una zona por la URL (desde "Explora por zona"), se aplica.
  useEffect(() => {
    setF((p) => ({ ...p, zona: zonaParam }));
  }, [zonaParam]);

  const set = (k: keyof Filtro, v: string) => setF((p) => ({ ...p, [k]: p[k] === v ? null : v }));

  const zonasDisponibles = Array.from(new Set(todos.map((t) => t.zona))).sort((a, b) => a.localeCompare(b, "es"));

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

  const lista = todos.filter(
    (t) =>
      (!f.zona || t.zona === f.zona) &&
      (!f.estilo || t.estilo === f.estilo) &&
      (!f.tipo || t.tipoEntrada === f.tipo) &&
      coincideTexto(t) &&
      enRango(t)
  );

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

      {cargando ? (
        <div className="flex flex-col items-center gap-3 py-16 text-tinta/50">
          <Loader2 size={36} className="animate-spin text-magenta" />
          <p className="font-bold">Cargando tardeos…</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm font-bold text-tinta/60">{lista.length} tardeos</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {lista.map((t) => (
              <TardeoCard key={t.id} tardeo={t} />
            ))}
          </div>
          {lista.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/60 ring-1 ring-magenta-100">
              No hay tardeos con esos filtros 😅
            </p>
          )}
        </>
      )}
    </main>
  );
}

export default function Tardeos() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold text-tinta/50">Cargando…</div>}>
      <TardeosContent />
    </Suspense>
  );
}
