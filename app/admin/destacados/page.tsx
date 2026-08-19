"use client";

import { useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { Store, Disc3, Megaphone, ArrowUp, ArrowDown, Star, X, Plus, Loader2 } from "lucide-react";
import { plegar, contieneTexto } from "@/lib/texto";

type Ficha = {
  id: string;
  nombre: string;
  tipo?: string;          // solo locales: local | promotor
  destacado_orden: number | null;
};
type Cual = "locales" | "djs";

/**
 * Quién sale primero, segundo y tercero en la home.
 *
 * El orden se guarda como 1, 2, 3… y se reescribe entero al mover algo: es más
 * simple y más robusto que ir intercambiando números sueltos, que se
 * desordenan en cuanto alguien borra una ficha por otro lado.
 *
 * Hoy lo pone el admin gratis. Cuando esto se cobre (§21.1), lo único que
 * cambia es quién decide el número.
 */
export default function AdminDestacados() {
  const [cual, setCual] = useState<Cual>("locales");
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let cancel = false;
    setCargando(true); setError("");
    (async () => {
      // Dos ramas explícitas: las tablas no comparten el nombre de la columna
      // del nombre, y un `select` con una variable rompe los tipos del cliente.
      const r = cual === "locales"
        ? await supabase.from("locales").select("id,nombre,tipo,destacado_orden").order("nombre")
        : await supabase.from("djs").select("id,nombre_artistico,destacado_orden").order("nombre_artistico");
      if (cancel) return;
      if (r.error) { setError(r.error.message); setCargando(false); return; }
      setFichas((r.data ?? []).map((x: Record<string, unknown>) => ({
        id: String(x.id),
        nombre: String(x.nombre ?? x.nombre_artistico ?? ""),
        tipo: x.tipo as string | undefined,
        destacado_orden: (x.destacado_orden ?? null) as number | null,
      })));
      setCargando(false);
    })();
    return () => { cancel = true; };
  }, [cual]);

  const destacados = fichas
    .filter((f) => f.destacado_orden !== null)
    .sort((a, b) => (a.destacado_orden ?? 0) - (b.destacado_orden ?? 0));
  const resto = fichas.filter((f) => f.destacado_orden === null);

  /** Reescribe 1..N y lo guarda. Recibe ya la lista en el orden final. */
  const guardarOrden = async (ordenados: Ficha[], fuera: Ficha[] = []) => {
    setGuardando(true); setError("");
    const cambios = [
      ...ordenados.map((f, i) => ({ id: f.id, destacado_orden: i + 1 })),
      ...fuera.map((f) => ({ id: f.id, destacado_orden: null })),
    ];
    // Pintamos ya y guardamos después: mover algo tiene que sentirse instantáneo.
    setFichas((p) => p.map((f) => {
      const c = cambios.find((x) => x.id === f.id);
      return c ? { ...f, destacado_orden: c.destacado_orden } : f;
    }));
    for (const c of cambios) {
      const { error: e } = await supabase.from(cual).update({ destacado_orden: c.destacado_orden }).eq("id", c.id);
      if (e) { setError(`No se pudo guardar: ${e.message}`); break; }
    }
    setGuardando(false);
  };

  const mover = (i: number, delta: number) => {
    const nuevo = [...destacados];
    const j = i + delta;
    if (j < 0 || j >= nuevo.length) return;
    [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    guardarOrden(nuevo);
  };

  const destacar = (f: Ficha) => guardarOrden([...destacados, f]);
  const quitar = (f: Ficha) => guardarOrden(destacados.filter((d) => d.id !== f.id), [f]);

  const Icono = ({ f }: { f: Ficha }) =>
    cual === "djs" ? <Disc3 size={20} className="text-magenta" />
      : f.tipo === "promotor" ? <Megaphone size={20} className="text-magenta" />
      : <Store size={20} className="text-magenta" />;

  // Sin tildes, igual que el buscador público: aquí se busca "Barbera" y el
  // local está fichado como "Barberà".
  const filtrado = resto.filter((f) => contieneTexto(f.nombre, plegar(busca.trim())));

  return (
    <main className="pb-10">
      <PanelHeader titulo="Destacados" volverHref="/admin" />
      <div className="mx-auto max-w-2xl px-4 pt-5 md:px-8">
        <div className="mb-4 flex gap-2">
          {(["locales", "djs"] as Cual[]).map((c) => (
            <button key={c} onClick={() => { setCual(c); setBusca(""); }}
              className={`min-h-[44px] flex-1 rounded-xl text-sm font-extrabold transition ${cual === c ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
              {c === "locales" ? "Locales y promotores" : "DJs"}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 rounded-xl bg-magenta-50 p-3 text-sm font-bold text-magenta">{error}</p>}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Star size={16} className="text-oro-600" />
              <p className="text-sm font-black text-tinta/70">
                Destacados ({destacados.length})
              </p>
              {guardando && <Loader2 size={14} className="animate-spin text-magenta" />}
            </div>

            {destacados.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">
                Ninguno destacado. Añade desde la lista de abajo y ordénalos con las flechas.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {destacados.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-tarjeta ring-1 ring-oro/40">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-oro/15 font-display text-lg font-black text-oro-600">
                      {i + 1}
                    </span>
                    <Icono f={f} />
                    <p className="min-w-0 flex-1 truncate font-black">{f.nombre}</p>
                    <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"
                      className="shrink-0 rounded-lg p-1.5 text-tinta/40 hover:bg-black/5 hover:text-magenta disabled:opacity-20">
                      <ArrowUp size={18} />
                    </button>
                    <button onClick={() => mover(i, 1)} disabled={i === destacados.length - 1} aria-label="Bajar"
                      className="shrink-0 rounded-lg p-1.5 text-tinta/40 hover:bg-black/5 hover:text-magenta disabled:opacity-20">
                      <ArrowDown size={18} />
                    </button>
                    <button onClick={() => quitar(f)} aria-label="Quitar de destacados"
                      className="shrink-0 rounded-lg p-1.5 text-tinta/30 hover:bg-black/5 hover:text-magenta">
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="mb-2 mt-6 text-sm font-black text-tinta/70">Añadir a destacados</p>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar entre ${resto.length}…`}
              className="mb-2 w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
            />
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {filtrado.slice(0, 40).map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-tarjeta ring-1 ring-black/5">
                  <Icono f={f} />
                  <p className="min-w-0 flex-1 truncate font-bold text-tinta/80">{f.nombre}</p>
                  <button onClick={() => destacar(f)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-magenta-50 px-3 py-2 text-xs font-black text-magenta hover:bg-magenta-100">
                    <Plus size={14} /> Destacar
                  </button>
                </div>
              ))}
              {filtrado.length > 40 && (
                <p className="py-2 text-center text-xs font-bold text-tinta/40">
                  y {filtrado.length - 40} más — afina la búsqueda
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
