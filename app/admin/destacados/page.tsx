"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Buscador, Filtros, useDiferido } from "@/components/panel/Paginacion";
import ListaOrdenable from "@/components/admin/ListaOrdenable";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { guardarOrdenEnBloque } from "@/components/admin/ordenar";
import { finDelDiaMadrid } from "@/components/admin/fechas";
import { refrescarPortada } from "@/components/admin/revalidar";
import { claseBoton } from "@/components/Boton";
import { supabase } from "@/lib/supabase";
import { hoyISO } from "@/lib/tardeos";
import { CalendarDays, Store, Megaphone, Disc3, Star, X, Plus, Loader2 } from "lucide-react";

type Cual = "tardeos" | "locales" | "djs";
type Item = {
  id: string;
  nombre: string;
  /** Línea secundaria: fecha y local, zona, "Promotor"… */
  sub: string | null;
  orden: number | null;
  /** Por qué no sale en la portada aunque esté destacado (oculto, sin publicar…). */
  noSale: string | null;
  fecha?: string;
  promotor?: boolean;
};

/** Quita lo que rompe la sintaxis de los filtros de PostgREST. */
const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

const ICONO = { tardeos: CalendarDays, locales: Store, djs: Disc3 } as const;
const ENLACE = { tardeos: "/tardeos/", locales: "/locales/", djs: "/djs/" } as const;

/* ---- Lecturas: siempre acotadas, nunca la tabla entera ---- */

type FilaTardeo = { id: string; titulo: string; fecha: string; estado: string; publicar_en: string | null; destacado_orden: number | null; locales: { nombre: string | null } | null };
type FilaLocal = { id: string; nombre: string; tipo: string | null; zona: string | null; estado: string | null; destacado_orden: number | null };
type FilaDj = { id: string; nombre_artistico: string; zonas: string[] | null; oculto: boolean | null; destacado_orden: number | null };

const visible = (t: FilaTardeo) =>
  t.estado === "publicado" || (t.estado === "programado" && Boolean(t.publicar_en) && new Date(t.publicar_en as string) <= new Date());

const deTardeo = (t: FilaTardeo): Item => ({
  id: t.id, nombre: t.titulo, fecha: t.fecha, orden: t.destacado_orden ?? null,
  sub: [t.fecha.split("-").reverse().join("/"), t.locales?.nombre].filter(Boolean).join(" · "),
  noSale: visible(t) ? null : "No sale: no está publicado",
});
const deLocal = (l: FilaLocal): Item => ({
  id: l.id, nombre: l.nombre, orden: l.destacado_orden ?? null, promotor: l.tipo === "promotor",
  sub: [l.tipo === "promotor" ? "Promotor" : null, l.zona].filter(Boolean).join(" · ") || null,
  noSale: l.estado === "activo" ? null : "No sale: ficha no publicada",
});
const deDj = (d: FilaDj): Item => ({
  id: d.id, nombre: d.nombre_artistico, orden: d.destacado_orden ?? null,
  sub: Array.isArray(d.zonas) && d.zonas.length ? d.zonas.join(", ") : null,
  noSale: d.oculto ? "No sale: DJ oculto" : null,
});

const COL_T = "id,titulo,fecha,estado,publicar_en,destacado_orden,locales(nombre)";
const COL_L = "id,nombre,tipo,zona,estado,destacado_orden";
const COL_D = "id,nombre_artistico,zonas,oculto,destacado_orden";

/** Los destacados de una pestaña, en el orden en que salen en la portada. */
async function leerDestacados(cual: Cual): Promise<{ items: Item[]; error: string | null }> {
  if (cual === "tardeos") {
    // En portada: destacado_hasta en el futuro, por orden y luego por fecha.
    const r = await supabase.from("tardeos").select(COL_T).gt("destacado_hasta", new Date().toISOString())
      .order("destacado_orden", { ascending: true, nullsFirst: false }).order("fecha").limit(100);
    return { items: ((r.data ?? []) as unknown as FilaTardeo[]).map(deTardeo), error: r.error?.message ?? null };
  }
  if (cual === "locales") {
    // Locales y promotores comparten tabla y bloque en la portada: un solo orden.
    const r = await supabase.from("locales").select(COL_L).not("destacado_orden", "is", null)
      .order("destacado_orden").limit(200);
    return { items: ((r.data ?? []) as unknown as FilaLocal[]).map(deLocal), error: r.error?.message ?? null };
  }
  const r = await supabase.from("djs").select(COL_D).not("destacado_orden", "is", null)
    .order("destacado_orden").limit(200);
  return { items: ((r.data ?? []) as unknown as FilaDj[]).map(deDj), error: r.error?.message ?? null };
}

/** Candidatos para añadir (máx. 12). Tardeos: los próximos aunque no se busque. */
async function buscarCandidatos(cual: Cual, texto: string): Promise<{ items: Item[]; error: string | null }> {
  const l = limpiar(texto);
  if (cual === "tardeos") {
    let q = supabase.from("tardeos").select(COL_T).eq("estado", "publicado").gte("fecha", hoyISO())
      .or(`destacado_hasta.is.null,destacado_hasta.lte.${new Date().toISOString()}`);
    if (l) q = q.ilike("titulo", `%${l}%`);
    const r = await q.order("fecha").limit(12);
    return { items: ((r.data ?? []) as unknown as FilaTardeo[]).map(deTardeo), error: r.error?.message ?? null };
  }
  if (!l) return { items: [], error: null };
  if (cual === "locales") {
    const r = await supabase.from("locales").select(COL_L).is("destacado_orden", null)
      .or(`nombre.ilike.%${l}%,zona.ilike.%${l}%`).order("nombre").limit(12);
    return { items: ((r.data ?? []) as unknown as FilaLocal[]).map(deLocal), error: r.error?.message ?? null };
  }
  const r = await supabase.from("djs").select(COL_D).is("destacado_orden", null)
    .ilike("nombre_artistico", `%${l}%`).order("nombre_artistico").limit(12);
  return { items: ((r.data ?? []) as unknown as FilaDj[]).map(deDj), error: r.error?.message ?? null };
}

/**
 * Quién sale primero en la portada: tardeos, locales (con promotores) y DJs.
 *
 * El orden se arrastra (o se sube/baja con botones) y se guarda solo, de una
 * vez, con `reordenar_destacados` (lote 45): todo o nada. Si la función aún no
 * está en la base se avisa; no se escribe fila a fila.
 *
 * Solo se leen los destacados y, para añadir, hasta 12 resultados de búsqueda:
 * nunca la tabla entera.
 */
export default function AdminDestacados() {
  const [cual, setCual] = useState<Cual>("tardeos");
  const [items, setItems] = useState<Item[]>([]);
  const [cuentas, setCuentas] = useState<Partial<Record<Cual, number>>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null); // id de ficha o "orden"
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [candidatos, setCandidatos] = useState<Item[]>([]);
  const [buscando, setBuscando] = useState(false);
  const seq = useRef(0);

  // Números de las pestañas (solo recuento).
  const contar = useCallback(() => {
    const cab = { count: "exact", head: true } as const;
    Promise.all([
      supabase.from("tardeos").select("id", cab).gt("destacado_hasta", new Date().toISOString()),
      supabase.from("locales").select("id", cab).not("destacado_orden", "is", null),
      supabase.from("djs").select("id", cab).not("destacado_orden", "is", null),
    ]).then(([t, l, d]) => setCuentas({
      tardeos: t.error ? undefined : t.count ?? 0,
      locales: l.error ? undefined : l.count ?? 0,
      djs: d.error ? undefined : d.count ?? 0,
    }));
  }, []);
  useEffect(() => { contar(); }, [contar]);

  useEffect(() => {
    let cancel = false;
    setCargando(true); setError(""); setOk(""); setItems([]);
    leerDestacados(cual).then(({ items, error }) => {
      if (cancel) return;
      if (error) setError("No se pudieron cargar los destacados: " + error);
      setItems(items); setCargando(false);
    });
    return () => { cancel = true; };
  }, [cual]);

  useEffect(() => {
    let cancel = false;
    setBuscando(true);
    buscarCandidatos(cual, busca).then(({ items, error }) => {
      if (cancel) return;
      if (error) setError("No se pudo buscar: " + error);
      setCandidatos(items); setBuscando(false);
    });
    return () => { cancel = true; };
  }, [cual, busca]);

  // Mientras se guarda no se cambia de pestaña, y cambiar invalida cualquier
  // respuesta pendiente: antes, un guardado que fallaba tarde pintaba los
  // tardeos dentro de la pestaña de DJs.
  const cambiarPestana = (c: Cual) => {
    if (guardando) return;
    seq.current++;
    setCual(c); setTexto(""); setCandidatos([]);
  };

  /** Pinta ya el orden nuevo y lo guarda de una vez; si falla, vuelve atrás. */
  const guardarOrden = async (ordenados: Item[]) => {
    const antes = items;
    const mia = ++seq.current;
    setItems(ordenados.map((x, i) => ({ ...x, orden: i + 1 })));
    setGuardando("orden"); setError(""); setOk("");
    const r = await guardarOrdenEnBloque(cual, ordenados.map((o) => o.id));
    if (mia !== seq.current) return;
    setGuardando(null);
    if (!r.ok) { setItems(antes); setError(r.mensaje); return; }
    setOk("Orden guardado. Así sale en la portada.");
    refrescarPortada();
  };

  /** Pone o quita una ficha. Se comprueba lo que devuelve la base, no lo pedido. */
  const escribir = async (f: Item, poner: boolean) => {
    if (guardando) return;
    if (poner && cual === "tardeos" && f.fecha && f.fecha < hoyISO()) { setError("Este tardeo ya pasó: no se puede destacar."); return; }
    setGuardando(f.id); setError(""); setOk("");
    const siguiente = Math.max(0, ...items.map((x) => x.orden ?? 0)) + 1;
    const cambio: Record<string, unknown> = cual === "tardeos"
      ? (poner ? { destacado_hasta: finDelDiaMadrid(f.fecha as string), destacado_orden: siguiente } : { destacado_hasta: null, destacado_orden: null })
      : { destacado_orden: poner ? siguiente : null };
    const { data, error: e } = await supabase.from(cual).update(cambio).eq("id", f.id).select("id,destacado_orden");
    setGuardando(null);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    const g = data?.[0] as { destacado_orden: number | null } | undefined;
    if (!g || (g.destacado_orden ?? null) !== (poner ? siguiente : null)) {
      setError("La base no aceptó el cambio. ¿Seguro que tu cuenta es admin?");
      return;
    }
    if (poner) {
      setItems((p) => [...p, { ...f, orden: siguiente }]);
      setCandidatos((p) => p.filter((x) => x.id !== f.id));
      setOk(`«${f.nombre}» destacado. Sale el último; arrástralo para subirlo.`);
    } else {
      setItems((p) => p.filter((x) => x.id !== f.id));
      setOk(`«${f.nombre}» quitado de destacados.`);
    }
    contar(); refrescarPortada();
  };

  // Funciones que pintan, no componentes: así no se remontan en cada render.
  const datos = (f: Item) => {
    const I = cual === "locales" && f.promotor ? Megaphone : ICONO[cual];
    return (
      <div className="flex min-w-0 items-center gap-2">
        <I size={20} className="shrink-0 text-magenta" aria-hidden />
        <div className="min-w-0">
          <Link href={`${ENLACE[cual]}${f.id}`} target="_blank" className="block truncate text-[15px] font-semibold leading-tight hover:text-magenta-700">
            {f.nombre || "(sin nombre)"}
          </Link>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {f.sub && <span className="truncate text-sm text-tinta-suave">{f.sub}</span>}
            {f.noSale && <Etiqueta tono="aviso">{f.noSale}</Etiqueta>}
          </div>
        </div>
      </div>
    );
  };

  const ocupado = guardando !== null;
  const textoVacio = {
    tardeos: "Ningún tardeo destacado. La portada enseñará los próximos por fecha.",
    locales: "Ningún local ni promotor destacado.",
    djs: "Ningún DJ destacado.",
  }[cual];

  return (
    <SeccionPanel
      titulo="Destacados"
      descripcion="Quién sale primero en la portada. Arrastra para ordenar: se guarda solo."
      ancho="estrecho"
    >
      <div className="mb-5">
        <Filtros<Cual>
          valor={cual}
          onCambiar={cambiarPestana}
          opciones={[
            { clave: "tardeos", label: "Tardeos", n: cuentas.tardeos },
            { clave: "locales", label: "Locales y promotores", n: cuentas.locales },
            { clave: "djs", label: "DJs", n: cuentas.djs },
          ]}
        />
      </div>

      <div aria-live="polite">
        {error && <Aviso tono="error">{error}</Aviso>}
        {ok && !error && <Aviso tono="ok">{ok}</Aviso>}
      </div>

      <section aria-label="Orden en portada">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <Star size={18} className="text-oro-600" aria-hidden /> En portada ({items.length})
          {guardando === "orden" && (
            <span className="inline-flex items-center gap-1 text-[15px] font-medium text-tinta-suave">
              <Loader2 size={16} className="animate-spin" aria-hidden /> Guardando…
            </span>
          )}
        </h2>
        <p className="mb-3 text-[15px] text-tinta-suave">El 1 sale el primero. Arrastra por el asa o usa las flechas.</p>

        {cargando ? (
          <div className="flex flex-col gap-2" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center text-[15px] text-tinta-suave">
            {textoVacio} Añade desde el buscador de abajo.
          </p>
        ) : (
          <ListaOrdenable
            items={items}
            onOrden={guardarOrden}
            nombre={(f) => f.nombre}
            deshabilitado={ocupado}
            contenido={datos}
            acciones={(f) => (
              <button type="button" onClick={() => escribir(f, false)} disabled={ocupado}
                aria-label={`Quitar ${f.nombre} de destacados`} className={claseBoton("contorno", "pequeno")}>
                {guardando === f.id ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <X size={18} aria-hidden />} Quitar
              </button>
            )}
          />
        )}
      </section>

      <section aria-label="Añadir a destacados" className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Añadir</h2>
        <Buscador valor={texto} onCambiar={setTexto}
          placeholder={cual === "tardeos" ? "Buscar tardeo por título…" : cual === "locales" ? "Buscar local o promotor…" : "Buscar DJ por nombre…"} />
        <div className="mt-3">
          {buscando && candidatos.length === 0 ? (
            <p className="flex items-center gap-2 py-4 text-[15px] text-tinta-suave"><Loader2 size={16} className="animate-spin" aria-hidden /> Buscando…</p>
          ) : candidatos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-5 text-center text-[15px] text-tinta-suave">
              {cual !== "tardeos" && !busca.trim() ? "Escribe un nombre para buscar."
                : cual === "tardeos" && !busca.trim() ? "No hay tardeos publicados de hoy en adelante sin destacar."
                : "Nada con esa búsqueda."}
            </p>
          ) : (
            <>
              {cual === "tardeos" && !busca.trim() && <p className="mb-2 text-sm text-tinta-suave">Próximos tardeos publicados:</p>}
              <ul className={`divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white ${buscando ? "opacity-60" : ""}`}>
                {candidatos.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">{datos(f)}</div>
                    <button type="button" onClick={() => escribir(f, true)} disabled={ocupado}
                      aria-label={`Destacar ${f.nombre}`} className={claseBoton("suave", "pequeno", false, "shrink-0")}>
                      {guardando === f.id ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Plus size={18} aria-hidden />} Destacar
                    </button>
                  </li>
                ))}
              </ul>
              {candidatos.length >= 12 && <p className="mt-2 text-sm text-tinta-suave">Se muestran 12: afina la búsqueda para ver otros.</p>}
            </>
          )}
        </div>
      </section>

      {cual === "tardeos" && (
        <p className="mt-6 text-sm text-tinta-suave">Un tardeo destacado deja de estarlo solo al terminar su día (hora de Madrid).</p>
      )}
    </SeccionPanel>
  );
}
