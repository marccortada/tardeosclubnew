"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Hoja from "@/components/ui/Hoja";
import { Etiqueta } from "@/components/ui/Chip";
import Boton, { claseBoton } from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import { supabase } from "@/lib/supabase";
import { hoyISO } from "@/lib/tardeos";
import { finDelDiaMadrid, partesFecha } from "@/components/admin/fechas";
import { refrescarPortada } from "@/components/admin/revalidar";
import { descargarCsv, leerPorLotes, hoyFichero } from "@/components/admin/csv";
import { useFiltroZona, SelectorZona, esperar } from "@/components/admin/FiltroZona";
import PanelFiltros, { CampoFiltro, claseFiltro, SelectorOrden, RangoFechas } from "@/components/panel/PanelFiltros";
import SelectorLocal from "@/components/SelectorLocal";
import { rangoFecha } from "@/lib/filtrosLista";
import {
  MoreHorizontal, Download, CheckCircle2, FileEdit, Ban, Flag, Star, StarOff, Pencil, ExternalLink, Trash2, Clock, Plus, Users, ClipboardCheck, X,
} from "lucide-react";

type Estado = "borrador" | "programado" | "publicado" | "finalizado" | "cancelado";
type Fila = {
  id: string;
  titulo: string;
  fecha: string;
  hora_inicio: string | null;
  estado: Estado;
  zona: string | null;
  publicar_en: string | null;
  destacado_hasta: string | null;
  destacado_orden: number | null;
  locales: { nombre: string | null; zona: string | null } | null;
  /** Zona normalizada (lote 69); solo llega si el lote está. */
  zona_slug?: string | null;
};
/** "visibles" y "destacados" eran contadores sueltos: ahora también filtran. */
type FiltroEstado = "todos" | "visibles" | "destacados" | Estado;
type FiltroTiempo = "todos" | "proximos" | "pasados";
/** "auto" = lo de siempre: próximos del más cercano al más lejano; el resto, lo más reciente primero. */
type Orden = "auto" | "fecha_asc" | "fecha_desc" | "creados";
type ConSin = "" | "con" | "sin";
/** Filtros del bloque plegable. Se aplican a la lista, al CSV y a los contadores. */
type Extras = { desde: string; hasta: string; localId: string; flyer: ConSin; aforo: ConSin };
type LocalMini = { id: string; nombre: string; zona: string | null; tipo: string | null };

const COLUMNAS = "id,titulo,fecha,hora_inicio,estado,zona,publicar_en,destacado_hasta,destacado_orden,locales(nombre,zona)";
/** Con el lote 69 se pide también la zona normalizada (para marcar "solo lectura"). */
const columnas = (conZona: boolean) => (conZona ? COLUMNAS + ",zona_slug" : COLUMNAS);

const TEXTO_ESTADO: Record<Estado, { t: string; tono: "neutro" | "ok" | "aviso" | "error" | "marca" }> = {
  borrador: { t: "Borrador", tono: "aviso" },
  programado: { t: "Programado", tono: "marca" },
  publicado: { t: "Publicado", tono: "ok" },
  finalizado: { t: "Finalizado", tono: "neutro" },
  cancelado: { t: "Cancelado", tono: "error" },
};

const estaDestacado = (f: Pick<Fila, "destacado_hasta">) => Boolean(f.destacado_hasta && new Date(f.destacado_hasta) > new Date());
const esVisible = (f: Pick<Fila, "estado" | "publicar_en">) =>
  f.estado === "publicado" || (f.estado === "programado" && Boolean(f.publicar_en) && new Date(f.publicar_en as string) <= new Date());

/** Quita lo que rompe la sintaxis de los filtros de PostgREST. */
const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

/**
 * Lo mínimo de una consulta de Supabase que usan los filtros de abajo. Se
 * tipa a mano porque el tipo real del constructor es tan profundo que
 * TypeScript se rinde al hacerlo genérico.
 */
type ConFiltros = {
  eq(c: string, v: string): ConFiltros; gt(c: string, v: string): ConFiltros; or(f: string): ConFiltros;
  gte(c: string, v: string): ConFiltros; lt(c: string, v: string): ConFiltros;
  is(c: string, v: null): ConFiltros; not(c: string, op: string, v: null): ConFiltros; neq(c: string, v: string): ConFiltros;
};

/** Aplica el filtro de estado (incluidos "visibles" y "destacados") a una consulta. */
function filtrarEstado<Q>(consulta: Q, f: FiltroEstado): Q {
  const q = consulta as unknown as ConFiltros;
  const ahora = new Date().toISOString();
  const r = f === "todos" ? q
    : f === "visibles" ? q.or(`estado.eq.publicado,and(estado.eq.programado,publicar_en.lte.${ahora})`)
    : f === "destacados" ? q.gt("destacado_hasta", ahora)
    : q.eq("estado", f);
  return r as unknown as Q;
}
function filtrarTiempo<Q>(consulta: Q, t: FiltroTiempo, x?: Extras): Q {
  // Con un rango de fechas puesto manda el rango: «Próximos» + «desde marzo
  // de 2025» no tendría sentido y daría listas vacías que despistan.
  if (x && (x.desde || x.hasta)) return rangoFecha(consulta, "fecha", x.desde, x.hasta);
  const q = consulta as unknown as ConFiltros;
  const hoy = hoyISO();
  const r = t === "proximos" ? q.gte("fecha", hoy) : t === "pasados" ? q.lt("fecha", hoy) : q;
  return r as unknown as Q;
}
/** Local, flyer y aforo (el rango de fechas va con `filtrarTiempo`). */
function filtrarExtras<Q>(consulta: Q, x: Extras): Q {
  let q = consulta as unknown as ConFiltros;
  if (x.localId) q = q.eq("local_id", x.localId);
  // "Sin flyer" incluye el texto vacío: algunos migrados guardaron "" en vez de null.
  if (x.flyer === "sin") q = q.or("flyer_url.is.null,flyer_url.eq.");
  if (x.flyer === "con") q = q.not("flyer_url", "is", null).neq("flyer_url", "");
  if (x.aforo === "con") q = q.not("aforo", "is", null);
  if (x.aforo === "sin") q = q.is("aforo", null);
  return q as unknown as Q;
}

/**
 * Gestión de tardeos (admin): listar, buscar, filtrar y cambiar estado.
 *
 * Hay unos 1.600 tardeos: se piden de 25 en 25 con `range` (paginación
 * numerada) y los contadores son consultas de solo recuento. Todo cambio se
 * comprueba con lo que devuelve la base (RLS o un trigger pueden revertir sin
 * dar error) y se enseña si falla.
 */
export default function GestionTardeos() {
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [estado, setEstado] = useState<FiltroEstado>("todos");
  const [tiempo, setTiempo] = useState<FiltroTiempo>("proximos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [localId, setLocalId] = useState("");
  const [flyer, setFlyer] = useState<ConSin>("");
  const [aforo, setAforo] = useState<ConSin>("");
  const [orden, setOrden] = useState<Orden>("auto");
  const [locales, setLocales] = useState<LocalMini[]>([]);
  const extras: Extras = { desde: fechaDesde, hasta: fechaHasta, localId, flyer, aforo };
  const claveExtras = JSON.stringify(extras);
  const [cEstado, setCEstado] = useState<Partial<Record<FiltroEstado, number>>>({});
  const [cTiempo, setCTiempo] = useState<Partial<Record<FiltroTiempo, number>>>({});
  const [errCont, setErrCont] = useState("");
  const [ok, setOk] = useState("");

  const [sel, setSel] = useState<Fila | null>(null);
  const [confirmar, setConfirmar] = useState<"cancelar" | "eliminar" | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [errHoja, setErrHoja] = useState("");

  const [exportando, setExportando] = useState<number | null>(null);
  // Filtro de zona (lote 69): el admin de zona ve lo suyo por defecto.
  const zona = useFiltroZona();
  const cols = columnas(zona.activo);

  // Locales y promotores para el filtro «Local»: unas decenas, se piden una vez.
  useEffect(() => {
    supabase.from("locales").select("id,nombre,zona,tipo").order("nombre").then(({ data }) => setLocales((data ?? []) as LocalMini[]));
  }, []);

  /**
   * La consulta con los filtros puestos, ya ordenada. La usan la lista y el
   * CSV: así lo exportado es exactamente lo filtrado.
   */
  const consultaFiltrada = async () => {
    let q = zona.aplicar(filtrarExtras(filtrarTiempo(filtrarEstado(supabase.from("tardeos").select(cols, { count: "exact" }), estado), tiempo, extras), extras));
    const l = limpiar(busca);
    if (l) {
      // El nombre del local está en otra tabla: primero se buscan sus ids
      // (con tope, para no montar un filtro kilométrico).
      const { data: ls, error: el } = await supabase.from("locales").select("id").ilike("nombre", `%${l}%`).limit(200);
      if (el) return { q: null, error: el };
      const ids = (ls ?? []).map((x) => x.id);
      const partes = [`titulo.ilike.%${l}%`, `zona.ilike.%${l}%`];
      if (ids.length) partes.push(`local_id.in.(${ids.join(",")})`);
      q = q.or(partes.join(","));
    }
    // .order("id") de desempate: cientos de tardeos migrados comparten fecha y
    // hora, y sin él la paginación repetía o se saltaba filas.
    if (orden === "creados") return { q: q.order("created_at", { ascending: false }).order("id"), error: null };
    // Automático: próximos (sin rango), el más cercano primero; resto, lo más reciente primero.
    const asc = orden === "fecha_asc" || (orden === "auto" && tiempo === "proximos" && !fechaDesde && !fechaHasta);
    return { q: q.order("fecha", { ascending: asc }).order("hora_inicio", { ascending: asc }).order("id"), error: null };
  };

  const p = usePaginado<Fila>(
    async (desde, hasta) => {
      // Hasta saber la zona del admin no se pide nada (si no, el de zona vería todo un instante).
      if (!zona.listo) return esperar();
      const { q, error: e } = await consultaFiltrada();
      if (!q) return { data: null, count: null, error: e };
      const r = await q.range(desde, hasta);
      return { data: (r.data ?? null) as unknown as Fila[] | null, count: r.count, error: r.error };
    },
    [estado, tiempo, busca, zona.clave, claveExtras, orden],
    25,
  );

  const exportarCsv = async () => {
    setExportando(0); setOk(""); setErrCont("");
    const { q, error: e } = await consultaFiltrada();
    if (!q) { setExportando(null); setErrCont("No se pudo exportar: " + (e?.message ?? "error")); return; }
    const { filas, error } = await leerPorLotes<Fila>(
      (desde, hasta) => q.range(desde, hasta) as unknown as PromiseLike<{ data: Fila[] | null; error: { message: string } | null }>,
      setExportando,
    );
    setExportando(null);
    if (error) { setErrCont("No se pudo exportar: " + error); return; }
    descargarCsv(`tardeos-${hoyFichero()}.csv`,
      ["Fecha", "Hora", "Título", "Local", "Zona", "Estado", "Destacado hasta", "Sale el", "Id"],
      filas.map((f) => [
        f.fecha, (f.hora_inicio ?? "").slice(0, 5), f.titulo, f.locales?.nombre ?? "", f.zona ?? f.locales?.zona ?? "",
        TEXTO_ESTADO[f.estado]?.t ?? f.estado, f.destacado_hasta ? new Date(f.destacado_hasta).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "",
        f.publicar_en ? new Date(f.publicar_en).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "", f.id,
      ]));
    setOk(`Exportados ${filas.length.toLocaleString("es-ES")} tardeos.`);
  };

  /**
   * Números de cada pestaña. Los de estado respetan el filtro de fecha (y al
   * revés), y todos el de zona: así el número de la pestaña es lo que saldrá
   * al pulsarla.
   */
  const contar = useCallback(async () => {
    if (!zona.listo) return;
    const cuenta = () => zona.aplicar(filtrarExtras(supabase.from("tardeos").select("id", { count: "exact", head: true }), extras));
    const estados: FiltroEstado[] = ["todos", "borrador", "programado", "publicado", "visibles", "destacados", "cancelado", "finalizado"];
    const tiempos: FiltroTiempo[] = ["todos", "proximos", "pasados"];
    const [re, rt] = await Promise.all([
      Promise.all(estados.map((e) => filtrarTiempo(filtrarEstado(cuenta(), e), tiempo, extras))),
      Promise.all(tiempos.map((t) => filtrarTiempo(filtrarEstado(cuenta(), estado), t, extras))),
    ]);
    const fallo = [...re, ...rt].find((r) => r.error);
    if (fallo?.error) { setErrCont("No se pudieron contar los tardeos: " + fallo.error.message); return; }
    setErrCont("");
    setCEstado(Object.fromEntries(estados.map((e, i) => [e, re[i].count ?? 0])));
    setCTiempo(Object.fromEntries(tiempos.map((t, i) => [t, rt[i].count ?? 0])));
  }, [estado, tiempo, zona.clave, claveExtras]); // eslint-disable-line react-hooks/exhaustive-deps -- `zona.clave` y `claveExtras` resumen los filtros
  useEffect(() => { contar(); }, [contar]);

  const cerrar = () => { setSel(null); setConfirmar(null); setErrHoja(""); };

  /** ¿Sigue la fila dentro de los filtros activos tras el cambio? */
  const sigueEnFiltro = (g: Fila) => {
    const okEstado = estado === "todos" ? true
      : estado === "visibles" ? esVisible(g)
      : estado === "destacados" ? estaDestacado(g)
      : g.estado === estado;
    const hoy = hoyISO();
    const okTiempo = fechaDesde || fechaHasta ? true : tiempo === "todos" || (tiempo === "proximos" ? g.fecha >= hoy : g.fecha < hoy);
    return okEstado && okTiempo;
  };

  /** Aplica un cambio y comprueba que la base lo guardó de verdad. */
  const aplicar = async (f: Fila, cambio: Record<string, unknown>, verificado: (g: Fila) => boolean, mensaje: string) => {
    setTrabajando(true); setErrHoja("");
    const { data, error: e } = await supabase.from("tardeos").update(cambio).eq("id", f.id).select(cols);
    setTrabajando(false);
    if (e) { setErrHoja("No se pudo guardar: " + e.message); return; }
    const g = (data?.[0] ?? null) as unknown as Fila | null;
    if (!g || !verificado(g)) {
      setErrHoja("La base no aceptó el cambio (puede que no tengas permiso). No se ha modificado nada.");
      return;
    }
    // Si el cambio la saca del filtro (p. ej. publicar estando en "Borradores"), se quita de la página.
    if (sigueEnFiltro(g)) p.cambiar((x) => x.id === f.id, g);
    else p.quitar((x) => x.id === f.id);
    setOk(`«${g.titulo}»: ${mensaje}`); cerrar();
    contar(); refrescarPortada();
  };

  const cambiarEstado = (f: Fila, nuevo: Estado, msg: string) =>
    aplicar(f, { estado: nuevo }, (g) => g.estado === nuevo, msg);

  const alternarDestacado = async (f: Fila) => {
    if (estaDestacado(f)) {
      return aplicar(f, { destacado_hasta: null, destacado_orden: null },
        (g) => g.destacado_hasta === null && g.destacado_orden === null, "quitado de destacados.");
    }
    // Un tardeo que ya pasó no se puede destacar: caducaría en el acto y la pantalla diría "Destacado" sin serlo.
    if (f.fecha < hoyISO()) { setErrHoja("Este tardeo ya pasó: no se puede destacar."); return; }
    // Se bloquea el botón ANTES de leer el orden: dos toques seguidos daban el mismo número a dos tardeos.
    if (trabajando) return;
    setTrabajando(true);
    // Va el último de los destacados; hasta el final de su día en hora de Madrid.
    const { data: m, error: e } = await supabase.from("tardeos").select("destacado_orden")
      .not("destacado_orden", "is", null).order("destacado_orden", { ascending: false }).limit(1);
    if (e) { setTrabajando(false); setErrHoja("No se pudo leer el orden de destacados: " + e.message); return; }
    const sig = (m?.[0]?.destacado_orden ?? 0) + 1;
    return aplicar(f, { destacado_hasta: finDelDiaMadrid(f.fecha), destacado_orden: sig },
      (g) => estaDestacado(g), "destacado. Puedes ordenarlo en Destacados.");
  };

  const eliminar = async (f: Fila) => {
    setTrabajando(true); setErrHoja("");
    const { data, error: e } = await supabase.from("tardeos").delete().eq("id", f.id).select("id");
    setTrabajando(false);
    if (e) { setErrHoja("No se pudo eliminar: " + e.message); return; }
    if (!data?.length) { setErrHoja("La base no eliminó nada (puede que no tengas permiso)."); return; }
    p.quitar((x) => x.id === f.id);
    setOk(`«${f.titulo}» eliminado.`); cerrar();
    contar(); refrescarPortada();
  };

  // Cuántos filtros del bloque plegable hay puestos (el rango cuenta como uno).
  const activos = [fechaDesde || fechaHasta, localId, flyer, aforo, orden !== "auto"].filter(Boolean).length;
  const quitarExtras = () => { setFechaDesde(""); setFechaHasta(""); setLocalId(""); setFlyer(""); setAforo(""); setOrden("auto"); };
  const localElegido = locales.find((l) => l.id === localId) ?? null;
  const hayFiltro = estado !== "todos" || tiempo !== "todos" || busca.trim() !== "" || zona.filtra || activos > 0;
  // Fuera de su zona el admin de zona solo mira: la base no le dejaría guardar (lote 69).
  const soloLectura = (f: Fila) => zona.activo && !zona.puedeEditar(f.zona_slug);

  return (
    <SeccionPanel
      titulo="Tardeos"
      descripcion="Publicar, cancelar, destacar, editar o exportar cualquier tardeo."
      acciones={
        <>
          <Boton variante="contorno" tamano="pequeno" onClick={exportarCsv} cargando={exportando !== null} disabled={p.total === 0}>
            {exportando === null && <Download size={18} aria-hidden />}
            {exportando !== null ? `Exportando… ${exportando}` : `Exportar CSV (${p.total.toLocaleString("es-ES")})`}
          </Boton>
          <Link href="/local/crear" className={claseBoton("primario", "pequeno")}>
            <Plus size={18} aria-hidden /> Nuevo tardeo
          </Link>
        </>
      }
      ancho="ancho"
    >
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar por título, local o zona…" />
          <SelectorZona zona={zona} />
        </div>
        <Filtros<FiltroTiempo>
          valor={tiempo}
          onCambiar={(t) => { setTiempo(t); setFechaDesde(""); setFechaHasta(""); }}
          opciones={[
            { clave: "proximos", label: "Próximos", n: cTiempo.proximos },
            { clave: "pasados", label: "Pasados", n: cTiempo.pasados },
            { clave: "todos", label: "Cualquier fecha", n: cTiempo.todos },
          ]}
        />
        <Filtros<FiltroEstado>
          valor={estado}
          onCambiar={setEstado}
          opciones={[
            { clave: "todos", label: "Todos", n: cEstado.todos },
            { clave: "borrador", label: "Borradores", n: cEstado.borrador },
            { clave: "visibles", label: "Visibles en la web", n: cEstado.visibles },
            { clave: "publicado", label: "Publicados", n: cEstado.publicado },
            { clave: "programado", label: "Programados", n: cEstado.programado },
            { clave: "destacados", label: "Destacados", n: cEstado.destacados },
            { clave: "cancelado", label: "Cancelados", n: cEstado.cancelado },
            { clave: "finalizado", label: "Finalizados", n: cEstado.finalizado },
          ]}
        />
        {(fechaDesde || fechaHasta) && (
          <p className="text-[15px] text-tinta-suave">Con fechas puestas en «Filtros» manda ese rango, no Próximos / Pasados.</p>
        )}
        <PanelFiltros clave="admin-tardeos" activos={activos} onLimpiar={quitarExtras}>
          <RangoFechas desde={fechaDesde} hasta={fechaHasta} onDesde={setFechaDesde} onHasta={setFechaHasta} etiqueta="Fecha del tardeo" />
          <SelectorOrden<Orden> valor={orden} onCambiar={setOrden} opciones={[
            { clave: "auto", label: "Automático (por fecha)" },
            { clave: "fecha_asc", label: "Fecha: antiguos primero" },
            { clave: "fecha_desc", label: "Fecha: recientes primero" },
            { clave: "creados", label: "Creados hace poco" },
          ]} />
          <CampoFiltro etiqueta="Flyer">
            <select value={flyer} onChange={(e) => setFlyer(e.target.value as ConSin)} className={claseFiltro}>
              <option value="">Con o sin flyer</option>
              <option value="sin">Sin flyer</option>
              <option value="con">Con flyer</option>
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Aforo">
            <select value={aforo} onChange={(e) => setAforo(e.target.value as ConSin)} className={claseFiltro}>
              <option value="">Con o sin aforo</option>
              <option value="con">Con aforo (plazas limitadas)</option>
              <option value="sin">Sin aforo</option>
            </select>
          </CampoFiltro>
          {/* No es un <label>: el buscador de locales tiene botones dentro. */}
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <span className="text-[14px] font-semibold text-tinta-suave">Local o promotor</span>
            {localElegido ? (
              <p className="flex min-h-[44px] items-center gap-2 rounded-xl bg-magenta-50 px-3 text-[15px] font-semibold">
                <span className="min-w-0 flex-1 truncate">{localElegido.nombre}{localElegido.zona ? ` · ${localElegido.zona}` : ""}</span>
                <button type="button" onClick={() => setLocalId("")} aria-label="Quitar el filtro de local"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-white">
                  <X size={18} aria-hidden />
                </button>
              </p>
            ) : locales.length > 0 ? (
              <SelectorLocal locales={locales} valor={localId} onCambio={setLocalId} />
            ) : (
              <p className="text-[15px] text-tinta-suave">Cargando locales…</p>
            )}
          </div>
        </PanelFiltros>
      </div>

      <div aria-live="polite">
        {errCont && <Aviso tono="error">{errCont}</Aviso>}
        {ok && <Aviso tono="ok">{ok}</Aviso>}
      </div>

      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio={hayFiltro ? "Ningún tardeo con esos filtros. Prueba con «Cualquier fecha» o borra la búsqueda." : "Todavía no hay tardeos."} />

      {p.filas.length > 0 && (
        <div className={`overflow-hidden rounded-2xl border border-linea bg-white ${p.cargando ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-linea bg-marfil text-[13px] font-semibold uppercase tracking-wide text-tinta-suave md:table-header-group">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tardeo</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {p.filas.map((f) => (
                <FilaTardeo key={f.id} f={f} soloLectura={soloLectura(f)} onAcciones={() => { setSel(f); setOk(""); }} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <Hoja
        abierta={sel !== null}
        onCerrar={cerrar}
        titulo={confirmar === "eliminar" ? "¿Eliminar este tardeo?" : confirmar === "cancelar" ? "¿Cancelar este tardeo?" : "¿Qué quieres hacer?"}
      >
        {sel && (
          <div>
            <p className="text-lg font-bold leading-tight">{sel.titulo}</p>
            <p className="mb-4 text-[15px] text-tinta-suave">{sel.fecha} · {sel.locales?.nombre ?? "Sin local"}</p>
            {errHoja && <Aviso tono="error">{errHoja}</Aviso>}

            {soloLectura(sel) ? (
              <div className="flex flex-col gap-3">
                <Aviso tono="aviso">
                  {sel.zona_slug ? "Este tardeo es de otra zona" : "Este tardeo no tiene zona"}: puedes verlo, pero solo lo cambia quien administra su zona.
                </Aviso>
                <Link href={`/tardeos/${sel.id}`} target="_blank" rel="noopener noreferrer" className={claseBoton("suave", "normal", true, "!justify-start")}>
                  <ExternalLink size={20} aria-hidden /> Ver ficha pública
                </Link>
              </div>
            ) : confirmar === "eliminar" ? (
              <div className="flex flex-col gap-3">
                <p className="rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">
                  Se borra para siempre, con sus favoritos e inscripciones. No se puede deshacer.
                  Si solo quieres que no se vea, mejor cancélalo o pásalo a borrador.
                </p>
                <Boton variante="peligro" ancho cargando={trabajando} onClick={() => eliminar(sel)}>Sí, eliminar para siempre</Boton>
                <Boton variante="contorno" ancho disabled={trabajando} onClick={() => setConfirmar(null)}>No, volver</Boton>
              </div>
            ) : confirmar === "cancelar" ? (
              <div className="flex flex-col gap-3">
                <p className="rounded-xl bg-aviso-fondo p-4 text-[15px] font-semibold text-aviso">
                  Dejará de verse en la web. Podrás volver a publicarlo cuando quieras.
                </p>
                <Boton variante="peligro" ancho cargando={trabajando} onClick={() => cambiarEstado(sel, "cancelado", "cancelado.")}>Sí, cancelar tardeo</Boton>
                <Boton variante="contorno" ancho disabled={trabajando} onClick={() => setConfirmar(null)}>No, volver</Boton>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sel.estado !== "publicado" && (
                  <Accion icono={<CheckCircle2 size={20} />} disabled={trabajando} onClick={() => cambiarEstado(sel, "publicado", "publicado.")}>
                    Publicar
                  </Accion>
                )}
                {sel.estado !== "borrador" && (
                  <Accion icono={<FileEdit size={20} />} disabled={trabajando} onClick={() => cambiarEstado(sel, "borrador", "pasado a borrador.")}>Pasar a borrador</Accion>
                )}
                {sel.estado !== "finalizado" && (
                  <Accion icono={<Flag size={20} />} disabled={trabajando} onClick={() => cambiarEstado(sel, "finalizado", "marcado como finalizado.")}>Marcar finalizado</Accion>
                )}
                {sel.estado !== "cancelado" && (
                  <Accion icono={<Ban size={20} />} disabled={trabajando} onClick={() => setConfirmar("cancelar")}>Cancelar tardeo…</Accion>
                )}
                <Accion icono={estaDestacado(sel) ? <StarOff size={20} /> : <Star size={20} />} disabled={trabajando} onClick={() => alternarDestacado(sel)}>
                  {estaDestacado(sel) ? "Quitar destacado" : "Poner destacado"}
                </Accion>
                <Link href={`/local/tardeos/${sel.id}/editar`} className={claseBoton("suave", "normal", true, "!justify-start")}>
                  <Pencil size={20} aria-hidden /> Editar
                </Link>
                {/* Dos sitios distintos: el registro del admin (confirmados, lista
                    de espera, mover o promover) y la lista de la ficha para pasar
                    lista el día del tardeo. */}
                <Link href={`/admin/registro?tardeo=${sel.id}`} className={claseBoton("suave", "normal", true, "!justify-start")}>
                  <Users size={20} aria-hidden /> Asistentes y espera
                </Link>
                <Link href={`/local/tardeos/${sel.id}/editar#apuntados`} className={claseBoton("suave", "normal", true, "!justify-start")}>
                  <ClipboardCheck size={20} aria-hidden /> Pasar lista en la ficha
                </Link>
                <Link href={`/tardeos/${sel.id}`} target="_blank" rel="noopener noreferrer" className={claseBoton("suave", "normal", true, "!justify-start")}>
                  <ExternalLink size={20} aria-hidden /> Ver ficha pública
                </Link>
                <hr className="my-2 border-linea" />
                <button type="button" disabled={trabajando} onClick={() => setConfirmar("eliminar")}
                  className={claseBoton("contorno", "normal", true, "!justify-start !border-error !text-error hover:!bg-error-fondo")}>
                  <Trash2 size={20} aria-hidden /> Eliminar…
                </button>
              </div>
            )}
          </div>
        )}
      </Hoja>
    </SeccionPanel>
  );
}

function Accion({ icono, children, onClick, disabled }: { icono: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={claseBoton("suave", "normal", true, "!justify-start")}>
      <span aria-hidden>{icono}</span> {children}
    </button>
  );
}

/** Fila de la tabla en escritorio; en móvil se apila como tarjeta. */
function FilaTardeo({ f, onAcciones, soloLectura }: { f: Fila; onAcciones: () => void; soloLectura: boolean }) {
  const p = partesFecha(f.fecha);
  const pasado = f.fecha < hoyISO();
  const e = TEXTO_ESTADO[f.estado] ?? { t: f.estado, tono: "neutro" as const };
  const zona = f.zona ?? f.locales?.zona;
  return (
    <tr className="flex flex-col gap-2 p-4 md:table-row md:p-0">
      <td className="md:w-[150px] md:px-4 md:py-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-content-center rounded-xl text-center ${pasado ? "bg-marfil-100 text-tinta-suave" : "bg-magenta-50 text-magenta-700"}`}>
            <span className="text-lg font-bold leading-none">{p.dia}</span>
            <span className="text-[11px] font-semibold uppercase">{p.mes} {String(p.anio).slice(2)}</span>
          </span>
          <span className="text-sm text-tinta-suave">
            <span className="block capitalize">{p.semana}</span>
            {f.hora_inicio && <span className="block">{f.hora_inicio.slice(0, 5)}</span>}
          </span>
        </div>
      </td>
      <td className="min-w-0 md:px-4 md:py-3">
        <p className="font-semibold leading-tight">{f.titulo}</p>
        <p className="text-sm text-tinta-suave">{f.locales?.nombre ?? "Sin local"}{zona ? <span className="md:hidden"> · {zona}</span> : null}</p>
      </td>
      <td className="hidden text-tinta-suave md:table-cell md:px-4 md:py-3">{zona || "—"}</td>
      <td className="md:px-4 md:py-3">
        <div className="flex flex-wrap gap-1.5">
          <Etiqueta tono={e.tono}>{e.t}</Etiqueta>
          {estaDestacado(f) && <Etiqueta tono="marca"><Star size={13} aria-hidden /> Destacado</Etiqueta>}
          {pasado && <Etiqueta>Ya pasó</Etiqueta>}
          {soloLectura && <Etiqueta>Solo lectura</Etiqueta>}
          {f.estado === "programado" && f.publicar_en && (
            <Etiqueta>
              <Clock size={13} aria-hidden /> Sale el {new Date(f.publicar_en).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
            </Etiqueta>
          )}
        </div>
      </td>
      <td className="md:px-4 md:py-3">
        <div className="flex items-center gap-1.5 md:justify-end">
          {!soloLectura && (
            <Link href={`/local/tardeos/${f.id}/editar`} aria-label={`Editar ${f.titulo}`}
              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-linea-fuerte bg-white hover:bg-marfil-100">
              <Pencil size={16} aria-hidden />
            </Link>
          )}
          <button type="button" onClick={onAcciones} aria-label={`${soloLectura ? "Ver" : "Más acciones para"} ${f.titulo}`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-linea-fuerte bg-white px-3 text-sm font-semibold hover:bg-marfil-100 md:flex-none">
            <MoreHorizontal size={18} aria-hidden /> {soloLectura ? "Ver" : "Acciones"}
          </button>
        </div>
      </td>
    </tr>
  );
}
