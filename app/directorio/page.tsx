"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import CabeceraApp from "@/components/CabeceraApp";
import Paginacion, { usePaginado, Buscador, EstadoLista, useDiferido } from "@/components/panel/Paginacion";
import { supabase } from "@/lib/supabase";
import { getZonas, type Zona } from "@/lib/tardicola";

type Pestana = "locales" | "promotores" | "djs";
type Ficha = { id: string; nombre: string; zona: string | null; foto: string | null };

/**
 * Directorio desde Eventos (dossier pág. 9): Locales · Promotores · DJs, con
 * buscador y paginación en el servidor. Arriba, las marcas que publican en
 * cada zona madre (zonas.marca, lote 63).
 */
export default function Directorio() {
  const [pestana, setPestana] = useState<Pestana>("locales");
  const [q, setQ] = useState("");
  const busca = useDiferido(q.trim());
  const [marcas, setMarcas] = useState<{ marca: string; zona: string }[]>([]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("ver");
    if (p === "promotores" || p === "djs" || p === "locales") setPestana(p);
    getZonas().then((zs: Zona[]) => {
      const vistas = new Map<string, string>();
      for (const z of zs) if (z.marca && !vistas.has(z.marca)) vistas.set(z.marca, z.zona_madre);
      setMarcas([...vistas].map(([marca, zona]) => ({ marca, zona: zona.charAt(0).toUpperCase() + zona.slice(1) })));
    });
  }, []);

  const pag = usePaginado<Ficha>(async (desde, hasta) => {
    const like = busca ? `%${busca.replace(/[%_,()]/g, " ")}%` : null;
    if (pestana === "djs") {
      let c = supabase.from("djs").select("id,nombre_artistico,avatar_url", { count: "exact" }).eq("oculto", false);
      if (like) c = c.ilike("nombre_artistico", like);
      const r = await c.order("nombre_artistico").order("id").range(desde, hasta);
      return { data: (r.data ?? []).map((d) => ({ id: d.id, nombre: d.nombre_artistico, zona: null, foto: d.avatar_url })), count: r.count, error: r.error };
    }
    let c = supabase.from("locales").select("id,nombre,zona,logo_url", { count: "exact" })
      .eq("estado", "activo").eq("tipo", pestana === "promotores" ? "promotor" : "local");
    if (like) c = c.or(`nombre.ilike.${like},zona.ilike.${like}`);
    const r = await c.order("nombre").order("id").range(desde, hasta);
    return { data: (r.data ?? []).map((l) => ({ id: l.id, nombre: l.nombre, zona: l.zona, foto: l.logo_url })), count: r.count, error: r.error };
  }, [pestana, busca], 20);

  const href = (f: Ficha) => (pestana === "djs" ? `/djs/${f.id}` : `/locales/${f.id}`);

  return (
    <main className="bg-fondo">
      <CabeceraApp titulo="Directorio" volver="/eventos" />
      <div className="mx-auto max-w-3xl px-4 pt-4 md:pt-8">
        <h1 className="hidden text-[34px] font-bold text-tinta md:block">Directorio</h1>
        <div className="flex gap-1 rounded-2xl bg-marfil-100 p-1" role="tablist">
          {(["locales", "promotores", "djs"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={pestana === k} onClick={() => { setPestana(k); pag.setPagina(1); }}
              className={`min-h-[44px] flex-1 rounded-xl text-[15px] font-semibold ${pestana === k ? "bg-magenta text-white" : "text-tinta"}`}>
              {k === "locales" ? "Locales" : k === "promotores" ? "Promotores" : "DJs"}
            </button>
          ))}
        </div>
        <div className="mt-3"><Buscador valor={q} onCambiar={(v) => { setQ(v); pag.setPagina(1); }} placeholder="Buscar por nombre o zona" /></div>

        {pestana === "promotores" && marcas.length > 0 && (
          <ul className="mt-4 divide-y divide-linea rounded-3xl border border-linea bg-superficie px-4">
            {marcas.map((m) => (
              <li key={m.marca} className="flex min-h-[52px] items-center justify-between text-[16px]">
                <span className="font-semibold text-tinta">{m.marca}</span><span className="text-[14px] text-tinta-suave">{m.zona}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <EstadoLista cargando={pag.cargando} error={pag.error} vacio="No hay nada con esa búsqueda." filas={pag.filas.length} />
          {/* grid-cols-1 = minmax(0,1fr): sin ella la columna medía lo que el
              nombre más largo y el `truncate` no cortaba (scroll lateral). */}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pag.filas.map((f) => (
              <li key={f.id} className="min-w-0">
                <Link href={href(f)} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-linea bg-superficie p-3">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-marfil-100">
                    {f.foto ? <Image src={f.foto} alt="" fill sizes="56px" className="object-cover" />
                      : <span className="grid h-full w-full place-items-center text-xl font-bold text-magenta-700">{f.nombre.charAt(0)}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold text-tinta">{f.nombre}</span>
                    {f.zona && <span className="block truncate text-[14px] text-tinta-suave">{f.zona}</span>}
                  </span>
                  <ChevronRight size={18} className="text-tinta-suave" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4"><Paginacion pagina={pag.pagina} total={pag.total} porPagina={pag.porPagina} onCambiar={pag.setPagina} cargando={pag.cargando} /></div>
        </div>
      </div>
    </main>
  );
}
