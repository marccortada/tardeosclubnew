"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import CabeceraApp from "@/components/CabeceraApp";
import Paginacion, { usePaginado, Buscador, EstadoLista, useDiferido } from "@/components/panel/Paginacion";
import { supabase } from "@/lib/supabase";
import { getZonas, type Zona } from "@/lib/tardicola";
import { optimizable } from "@/lib/fotos";

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

  /**
   * Con foto primero y, dentro de cada grupo, por nombre. Una lista que abre
   * con letras sobre gris parecía vacía; las fichas sin logo van al final.
   * PostgREST no ordena por «tiene logo», así que son dos consultas (con y sin
   * foto) y la página se reparte entre ellas: sigue paginado en el servidor.
   */
  const pag = usePaginado<Ficha>(async (desde, hasta) => {
    const like = busca ? `%${busca.replace(/[%_,()]/g, " ")}%` : null;
    const djs = pestana === "djs";
    const colFoto = djs ? "avatar_url" : "logo_url";
    const base = (conFoto: boolean) => {
      let c = djs
        ? supabase.from("djs").select("id,nombre_artistico,avatar_url", { count: "exact" }).eq("oculto", false)
        : supabase.from("locales").select("id,nombre,zona,logo_url", { count: "exact" })
            .eq("estado", "activo").eq("tipo", pestana === "promotores" ? "promotor" : "local");
      if (like) c = djs ? c.ilike("nombre_artistico", like) : c.or(`nombre.ilike.${like},zona.ilike.${like}`);
      // Solo null cuenta como «sin foto»: un segundo .or() junto al del
      // buscador no se combina de forma fiable. Una cadena vacía (raro) sale
      // en el primer grupo con la inicial, como antes.
      c = conFoto ? c.not(colFoto, "is", null) : c.is(colFoto, null);
      return c.order(djs ? "nombre_artistico" : "nombre").order("id");
    };
    const aFicha = (x: Record<string, unknown>): Ficha => djs
      ? { id: x.id as string, nombre: x.nombre_artistico as string, zona: null, foto: (x.avatar_url as string) || null }
      : { id: x.id as string, nombre: x.nombre as string, zona: (x.zona as string) ?? null, foto: (x.logo_url as string) || null };

    // 1) Cuántas hay con foto. range(0,0) y no la página directamente: pedir
    //    un tramo que empieza más allá del total da error 416 en PostgREST.
    const cuenta = await base(true).range(0, 0);
    if (cuenta.error) return { data: [], count: null, error: cuenta.error };
    const nCon = cuenta.count ?? 0;
    const filas: Ficha[] = [];
    if (desde < nCon) {
      const r = await base(true).range(desde, Math.min(hasta, nCon - 1));
      if (r.error) return { data: [], count: null, error: r.error };
      filas.push(...(r.data ?? []).map((x) => aFicha(x as Record<string, unknown>)));
    }
    // 2) El resto de la página, de las sin foto (desplazado lo que ocupan las
    //    de foto). Si no llega, se pide una sola fila para saber el total.
    const r2 = hasta >= nCon
      ? await base(false).range(Math.max(0, desde - nCon), hasta - nCon)
      : await base(false).range(0, 0);
    if (r2.error) return { data: [], count: null, error: r2.error };
    if (hasta >= nCon) filas.push(...(r2.data ?? []).map((x) => aFicha(x as Record<string, unknown>)));
    return { data: filas, count: nCon + (r2.count ?? 0), error: null };
  }, [pestana, busca], 20);

  const href = (f: Ficha) => (pestana === "djs" ? `/djs/${f.id}` : `/locales/${f.id}`);

  return (
    <main className="bg-fondo">
      <CabeceraApp titulo="Directorio" volver="/eventos" sinH1 />
      <div className="mx-auto max-w-3xl px-4 pt-4 md:pt-8">
        {/* Un solo h1: oculto a la vista en móvil (allí el título lo pinta la barra). */}
        <h1 className="sr-only text-[34px] font-bold text-tinta md:not-sr-only">Directorio</h1>
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
                <Link href={href(f)} prefetch={false} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-linea bg-superficie p-3">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-marfil-100">
                    {f.foto ? <Image src={f.foto} alt="" fill sizes="56px" unoptimized={!optimizable(f.foto)} className="object-cover" />
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
