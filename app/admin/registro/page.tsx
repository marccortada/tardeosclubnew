"use client";

import { useEffect, useState, useRef } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import Hoja from "@/components/ui/Hoja";
import { Etiqueta } from "@/components/ui/Chip";
import { supabase } from "@/lib/supabase";
import { marcarAsistencia } from "@/lib/tardeos";
import { useFiltroZona, SelectorZona, esperar, type FiltroZona } from "@/components/admin/FiltroZona";
import PanelFiltros, { CampoFiltro, RangoFechas, claseFiltro } from "@/components/panel/PanelFiltros";
import PasarLista from "@/app/local/_panel/PasarLista";
import Link from "next/link";
import { Download, Users, CheckCircle2, XCircle, Clock, X, CalendarDays, ExternalLink, Search } from "lucide-react";

/**
 * Registro de asistencias: quién se ha apuntado a qué tardeo y si vino.
 * Es la pestaña "Registro" de la web antigua (con su exportación), sobre las
 * inscripciones de la web nueva. Pide el lote 48 para la asistencia; sin él
 * enseña los apuntados igualmente y avisa.
 *
 * Paginado en el servidor: antes se cargaba todo y se filtraba en el
 * navegador, lo que deja de funcionar en cuanto crecen las inscripciones. El
 * CSV, en cambio, exporta TODO lo filtrado pidiéndolo por lotes de 1000.
 */
type Asist = "pendiente" | "asistio" | "no_asistio";
type Estado = "todos" | "apuntado" | "espera" | "cancelado";
type EstadoIns = "apuntado" | "espera" | "cancelado";
type Periodo = "todos" | "proximos" | "pasados";
type BuscarEn = "persona" | "tardeo";

type Bruta = {
  id: string; tardeo_id: string; estado: EstadoIns; asistencia?: Asist | null; created_at: string;
  profiles: { display_name: string | null; email: string | null } | null;
  tardeos: { titulo: string | null; fecha: string | null; hora_inicio: string | null; zona_slug?: string | null; locales: { nombre: string | null } | null } | null;
};

type Filtro = { estado: Estado; asist: "todas" | Asist; periodo: Periodo; desde: string; hasta: string; busca: string; buscaEn: BuscarEn; sinAsistencia: boolean; tardeoId: string | null };
type TardeoElegido = { id: string; titulo: string | null; fecha: string | null; hora_inicio: string | null; local: string | null };

const hoyMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
const fechaCorta = (f: string) =>
  new Date(f + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const NOMBRE_ESTADO: Record<EstadoIns, string> = { apuntado: "Apuntado", espera: "En espera", cancelado: "Cancelado" };
const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
const esColumnaQueFalta = (e: unknown) => {
  const c = (e as { code?: string } | null)?.code;
  return c === "42703" || c === "PGRST204";
};

/**
 * La consulta con todos los filtros aplicados. Se usa igual para la página
 * visible y para el CSV, así lo exportado es exactamente lo filtrado.
 *
 * Filtrar por un campo de la persona o del tardeo exige `!inner`: sin él,
 * PostgREST deja la fila y solo vacía el objeto anidado. La zona (lote 69)
 * es la del tardeo: `tardeos.zona_slug`.
 */
function consulta(f: Filtro, contar: boolean, zona: FiltroZona) {
  const porPersona = !!f.busca && f.buscaEn === "persona";
  const porTardeo = (!!f.busca && f.buscaEn === "tardeo") || f.periodo !== "todos" || !!f.desde || !!f.hasta || zona.filtra;
  const cols = [
    "id,tardeo_id,estado,created_at",
    f.sinAsistencia ? "" : "asistencia",
    `profiles${porPersona ? "!inner" : ""}(display_name,email)`,
    `tardeos${porTardeo ? "!inner" : ""}(titulo,fecha,hora_inicio,${zona.activo ? "zona_slug," : ""}locales(nombre))`,
  ].filter(Boolean).join(",");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- la select se arma en tiempo de ejecución y el tipado de supabase-js no la sigue
  let q: any = supabase.from("inscripciones").select(cols, contar ? { count: "exact" } : undefined);
  // Con un tardeo elegido, la cuenta y el CSV son solo de ese tardeo (antes el
  // botón exportaba todo el registro aunque se estuviera mirando uno).
  // Los demás filtros están ocultos en ese modo: se exporta la lista entera del
  // tardeo (confirmados, espera y cancelados), igual que la que se ve.
  if (f.tardeoId) return q.eq("tardeo_id", f.tardeoId).order("estado").order("created_at").order("id");
  if (f.estado !== "todos") q = q.eq("estado", f.estado);
  if (!f.sinAsistencia && f.asist !== "todas") q = q.eq("asistencia", f.asist);
  // Un rango de fechas manda sobre Próximos / Pasados.
  if (f.desde || f.hasta) {
    if (f.desde) q = q.gte("tardeos.fecha", f.desde);
    if (f.hasta) q = q.lte("tardeos.fecha", f.hasta);
  } else if (f.periodo === "proximos") q = q.gte("tardeos.fecha", hoyMadrid());
  else if (f.periodo === "pasados") q = q.lt("tardeos.fecha", hoyMadrid());
  const l = limpiar(f.busca);
  if (l && f.buscaEn === "persona") q = q.or(`display_name.ilike.%${l}%,email.ilike.%${l}%`, { referencedTable: "profiles" });
  if (l && f.buscaEn === "tardeo") q = q.ilike("tardeos.titulo", `%${l}%`);
  q = zona.aplicar(q, "tardeos");
  // `id` desempata: con created_at repetidos, las páginas (y los bloques del
  // CSV) podían repetir o saltarse filas.
  return q.order("created_at", { ascending: false }).order("id");
}

/**
 * Celda de CSV a prueba de inyección de fórmulas: Excel ejecuta lo que empieza
 * por = + - @ (y tabulador / retorno). Un nombre como «=HYPERLINK(...)» se
 * convertiría en un enlace activo al abrir el fichero. Con una comilla simple
 * delante se queda en texto.
 */
const celda = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function Registro() {
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [buscaEn, setBuscaEn] = useState<BuscarEn>("persona");
  const [estado, setEstado] = useState<Estado>("apuntado");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  // Un tardeo concreto: en vez de la tabla general se ve su lista completa
  // (resumen, espera con puesto, dar plaza, cancelar…), la misma de su ficha.
  // Llega por ?tardeo=<id> (desde Tardeos), por el buscador de tardeos o
  // tocando el título en una fila.
  const [tardeo, setTardeo] = useState<TardeoElegido | null>(null);
  const [asist, setAsist] = useState<"todas" | Asist>("todas");
  const [sinAsistencia, setSinAsistencia] = useState(false);
  const [resumen, setResumen] = useState<{ apuntados?: number; asistio?: number; no_asistio?: number; pendiente?: number }>({});
  const [obrando, setObrando] = useState<string | null>(null);
  const [exportando, setExportando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  /** Cambio de estado pendiente de confirmar: el desplegable ya no mueve a la primera. */
  const [porMover, setPorMover] = useState<{ f: Bruta; a: EstadoIns } | null>(null);
  // Filtro de zona (lote 69), por la zona del tardeo de cada inscripción.
  const zona = useFiltroZona();

  const filtro: Filtro = { estado, asist, periodo, desde, hasta, busca, buscaEn, sinAsistencia, tardeoId: tardeo?.id ?? null };

  const elegirTardeo = async (id: string) => {
    const { data } = await supabase.from("tardeos").select("id,titulo,fecha,hora_inicio,locales(nombre)").eq("id", id).maybeSingle();
    if (!data) { setError("No se encontró ese tardeo."); return; }
    const d = data as unknown as { id: string; titulo: string | null; fecha: string | null; hora_inicio: string | null; locales: { nombre: string | null } | null };
    setTardeo({ id: d.id, titulo: d.titulo, fecha: d.fecha, hora_inicio: d.hora_inicio, local: d.locales?.nombre ?? null });
    setError(""); setOk("");
    // La URL lo recuerda: recargar o compartir el enlace abre el mismo tardeo.
    window.history.replaceState(null, "", `/admin/registro?tardeo=${d.id}`);
    window.scrollTo({ top: 0 });
  };
  const soltarTardeo = () => { setTardeo(null); window.history.replaceState(null, "", "/admin/registro"); };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tardeo");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) elegirTardeo(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const p = usePaginado<Bruta>(
    (desde, hasta) => !zona.listo ? esperar() :
      (consulta(filtro, true, zona).range(desde, hasta) as PromiseLike<{ data: Bruta[] | null; count: number | null; error: unknown }>).then((r) => {
        // Sin el lote 48 no existe la columna `asistencia`: se repite sin ella.
        // (Se devuelve vacío sin error para que no parpadee un fallo mientras.)
        if (r.error && !sinAsistencia && esColumnaQueFalta(r.error)) {
          setSinAsistencia(true);
          return { data: [], count: 0, error: null };
        }
        return r;
      }),
    [estado, asist, periodo, desde, hasta, busca, buscaEn, sinAsistencia, zona.clave, tardeo?.id ?? null],
    25,
  );

  // Resumen (solo recuentos, sin filas). No depende de los filtros de la
  // lista, pero sí de la zona: al admin de Tarragona le sirve SU resumen.
  const contar = () => {
    if (!zona.listo) return;
    const base = () => zona.aplicar(
      supabase.from("inscripciones").select(zona.filtra ? "id,tardeos!inner(zona_slug)" : "id", { count: "exact", head: true }).eq("estado", "apuntado"),
      "tardeos");
    Promise.all([
      base(),
      sinAsistencia ? null : base().eq("asistencia", "asistio"),
      sinAsistencia ? null : base().eq("asistencia", "no_asistio"),
      sinAsistencia ? null : base().eq("asistencia", "pendiente"),
    ]).then(([a, b, c, d]) => setResumen({
      apuntados: a.count ?? undefined, asistio: b?.count ?? undefined, no_asistio: c?.count ?? undefined, pendiente: d?.count ?? undefined,
    }));
  };
  useEffect(contar, [sinAsistencia, zona.clave]); // eslint-disable-line react-hooks/exhaustive-deps -- `zona.clave` resume el filtro de zona

  const marcar = async (f: Bruta, valor: Asist) => {
    if (f.asistencia === valor) return;
    setObrando(f.id); setError(""); setOk("");
    const { error: e } = await marcarAsistencia(f.id, valor);
    setObrando(null);
    if (e) { setError("No se pudo guardar la asistencia: " + e.message); return; }
    p.cambiar((x) => x.id === f.id, { asistencia: valor });
    contar();
  };

  const mover = async (f: Bruta, estadoNuevo: EstadoIns) => {
    if (f.estado === estadoNuevo) return;
    setObrando(f.id); setError(""); setOk("");
    const { error: e } = await supabase.rpc("admin_mover_inscripcion", { p_inscripcion: f.id, p_estado: estadoNuevo });
    setObrando(null);
    if (e) {
      const c = (e as { code?: string }).code;
      setError(c === "PGRST202" || c === "42883" ? "Falta el lote 69 para mover inscripciones." : "No se pudo mover: " + e.message);
      return;
    }
    // Se recarga la página entera, no solo la fila: si se ha liberado una
    // plaza, la base (lote 64) sube sola al primero de la espera, y esa fila
    // también cambia. Sin recargar se seguía viendo «En espera» y al pulsar
    // «Promover» respondía que ya no había nadie.
    setOk(f.estado === "apuntado" && estadoNuevo !== "apuntado"
      ? "Inscripción movida. Si había lista de espera, el primero ha subido solo. Queda en la auditoría."
      : "Inscripción movida. Queda en la auditoría.");
    p.recargar();
    contar();
  };

  const promover = async (f: Bruta) => {
    setObrando(f.id); setError(""); setOk("");
    const { data, error: e } = await supabase.rpc("admin_promover_espera", { p_tardeo: f.tardeo_id });
    setObrando(null);
    if (e) { setError("No se pudo promover: " + e.message); return; }
    // La función devuelve el id de la inscripción que ha subido, o null si
    // ya no quedaba nadie (p. ej. porque el sistema lo había subido solo al
    // liberarse una plaza y esta lista estaba sin recargar).
    if (data) setOk("Hecho: el primero de la lista de espera ya está confirmado.");
    else setOk("Ya no quedaba nadie en espera en ese tardeo: el sistema sube solo al primero cuando se libera una plaza. Lista actualizada.");
    p.recargar();
    contar();
  };

  const exportarCsv = async () => {
    setExportando(0); setError(""); setOk("");
    const todas: Bruta[] = [];
    // Por lotes de 1000 (el tope de PostgREST por petición), hasta agotar.
    for (let desde = 0; desde < 100000; desde += 1000) {
      const { data, error: e } = await consulta(filtro, false, zona).range(desde, desde + 999);
      if (e) { setExportando(null); setError("No se pudo exportar: " + e.message); return; }
      todas.push(...((data ?? []) as Bruta[]));
      setExportando(todas.length);
      if ((data ?? []).length < 1000) break;
    }
    const nombreAsist: Record<string, string> = { pendiente: "Sin marcar", asistio: "Vino", no_asistio: "No vino" };
    const cab = ["Nombre", "Email", "Tardeo", "Fecha", "Hora", "Local", "Estado", "Asistencia", "Apuntado el"];
    const cuerpo = todas.map((f) => [
      f.profiles?.display_name || "Tardícola", f.profiles?.email || "",
      f.tardeos?.titulo || "(tardeo borrado)", f.tardeos?.fecha || "", (f.tardeos?.hora_inicio || "").slice(0, 5),
      f.tardeos?.locales?.nombre || "",
      f.estado === "apuntado" ? "Apuntado" : f.estado === "espera" ? "En espera" : "Cancelado",
      f.asistencia ? nombreAsist[f.asistencia] : "", new Date(f.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }),
    ].map(celda).join(";"));
    // BOM + punto y coma: Excel en español lo abre con acentos y columnas bien.
    const blob = new Blob(["﻿" + [cab.map(celda).join(";"), ...cuerpo].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `asistencias-${hoyMadrid()}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExportando(null);
    setOk(`Exportadas ${todas.length.toLocaleString("es-ES")} inscripciones.`);
  };

  const nPanel = (periodo !== "todos" ? 1 : 0) + (desde ? 1 : 0) + (hasta ? 1 : 0) + (asist !== "todas" ? 1 : 0);
  const hayFiltros = !!busca || estado !== "apuntado" || nPanel > 0;
  // Fuera de su zona el admin de zona solo mira: mover o promover lo rechaza
  // la base (lote 69), y la asistencia se deja igual de quieta para que la
  // fila sea de verdad "solo lectura".
  const soloLectura = (f: Bruta) => zona.activo && !zona.puedeEditar(f.tardeos?.zona_slug);
  const limpiarPanel = () => { setPeriodo("todos"); setDesde(""); setHasta(""); setAsist("todas"); };
  const limpiarFiltros = () => { setTexto(""); setEstado("apuntado"); limpiarPanel(); };

  return (
    <SeccionPanel
      titulo="Registro de asistencias"
      descripcion="Quién se ha apuntado a cada tardeo y si vino. El CSV sale con los filtros que tengas puestos."
      acciones={
        <Boton tamano="pequeno" variante="contorno" onClick={exportarCsv} cargando={exportando !== null} disabled={p.total === 0}>
          <Download size={18} aria-hidden /> {exportando !== null ? `Exportando… ${exportando}` : `Exportar CSV (${p.total.toLocaleString("es-ES")})`}
        </Boton>
      }
      ancho="ancho"
    >
      {/* Con un tardeo elegido manda SU resumen (dentro de la lista): el general
          (todas las inscripciones) al lado confundía. */}
      <section className={`mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 ${tardeo ? "hidden" : ""}`} aria-label={zona.filtra ? "Resumen de las inscripciones de la zona elegida" : "Resumen de todas las inscripciones"}>
        {[
          { icono: Users, t: "Apuntados", v: resumen.apuntados },
          { icono: CheckCircle2, t: "Vinieron", v: resumen.asistio },
          { icono: XCircle, t: "No vinieron", v: resumen.no_asistio },
          { icono: Clock, t: "Sin marcar", v: resumen.pendiente },
        ].map(({ icono: I, t, v }) => (
          <div key={t} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
            <I size={20} className="text-magenta" aria-hidden />
            <p className="mt-2 text-2xl font-bold leading-none">{v == null ? "—" : v.toLocaleString("es-ES")}</p>
            <p className="mt-1 text-sm text-tinta-suave">{t}</p>
          </div>
        ))}
      </section>

      {sinAsistencia && (
        <Aviso tono="aviso">
          Falta pegar el lote 48 (supabase/48_reservas_aforo_asistencia.sql) para poder marcar la asistencia. Mientras, se ve quién se ha apuntado.
        </Aviso>
      )}
      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tono="ok">{ok}</Aviso>}

      <SelectorTardeo onElegir={elegirTardeo} />

      {tardeo ? (
        <section aria-label="Asistentes del tardeo elegido" className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold uppercase tracking-wide text-magenta-700">Tardeo elegido</p>
              <h2 className="text-[20px] font-extrabold leading-tight">{tardeo.titulo || "Tardeo"}</h2>
              <p className="flex items-center gap-1.5 text-[15px] text-tinta-suave">
                <CalendarDays size={15} aria-hidden />
                {tardeo.fecha ? fechaCorta(tardeo.fecha) : "Sin fecha"}{tardeo.hora_inicio ? ` · ${tardeo.hora_inicio.slice(0, 5)}` : ""}{tardeo.local ? ` · ${tardeo.local}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/local/tardeos/${tardeo.id}/editar#apuntados`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-linea-fuerte px-3 text-[15px] font-semibold">
                <ExternalLink size={16} aria-hidden /> Ficha del tardeo
              </Link>
              <button type="button" onClick={soltarTardeo}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-linea-fuerte px-3 text-[15px] font-semibold">
                <X size={16} aria-hidden /> Ver todos
              </button>
            </div>
          </div>
          <PasarLista key={tardeo.id} tardeoId={tardeo.id} />
        </section>
      ) : (<>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Buscador valor={texto} onCambiar={setTexto}
            placeholder={buscaEn === "persona" ? "Buscar persona por nombre o email…" : "Buscar por título del tardeo…"} />
          <SelectorZona zona={zona} />
          <div role="group" aria-label="Dónde buscar" className="flex gap-1.5">
            {([["persona", "En personas"], ["tardeo", "En tardeos"]] as [BuscarEn, string][]).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setBuscaEn(k)} aria-pressed={buscaEn === k}
                className={`min-h-[44px] rounded-xl border px-3.5 text-[15px] font-semibold transition-colors ${
                  buscaEn === k ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white hover:bg-marfil-100"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <Filtros<Estado>
          valor={estado}
          onCambiar={setEstado}
          opciones={[
            { clave: "apuntado", label: "Apuntados" },
            { clave: "espera", label: "En espera" },
            { clave: "cancelado", label: "Cancelados" },
            { clave: "todos", label: "Todos" },
          ]}
        />

        <PanelFiltros clave="admin-registro" activos={nPanel} onLimpiar={limpiarPanel}>
          <CampoFiltro etiqueta="Cuándo es el tardeo">
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className={claseFiltro} disabled={!!desde || !!hasta}>
              <option value="todos">Cualquier fecha</option>
              <option value="proximos">Próximos</option>
              <option value="pasados">Pasados</option>
            </select>
          </CampoFiltro>
          <RangoFechas etiqueta="Día del tardeo" desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
          {!sinAsistencia && (
            <CampoFiltro etiqueta="Asistencia">
              <select value={asist} onChange={(e) => setAsist(e.target.value as "todas" | Asist)} className={claseFiltro}>
                <option value="todas">Toda asistencia</option>
                <option value="pendiente">Sin marcar</option>
                <option value="asistio">Vinieron</option>
                <option value="no_asistio">No vinieron</option>
              </select>
            </CampoFiltro>
          )}
        </PanelFiltros>

        {hayFiltros && (
          <button type="button" onClick={limpiarFiltros}
            className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-lg px-2 text-[15px] font-semibold text-magenta-700 hover:bg-magenta-50">
            <X size={16} aria-hidden /> Quitar filtros
          </button>
        )}
      </div>

      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio={hayFiltros || zona.filtra ? "Ninguna inscripción con esos filtros." : "Todavía no se ha apuntado nadie."} />

      {p.filas.length > 0 && (
        <div className={`overflow-hidden rounded-2xl border border-linea bg-white ${p.cargando ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-linea bg-marfil text-[13px] font-semibold uppercase tracking-wide text-tinta-suave md:table-header-group">
              <tr>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Tardeo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Asistencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {p.filas.map((f) => (
                <tr key={f.id} className="flex flex-col gap-2 p-4 md:table-row md:p-0">
                  <td className="md:px-4 md:py-3">
                    <p className="font-semibold leading-tight">{f.profiles?.display_name || "Tardícola"}</p>
                    {f.profiles?.email && <p className="truncate text-sm text-tinta-suave">{f.profiles.email}</p>}
                  </td>
                  <td className="md:px-4 md:py-3">
                    {/* Tocar el tardeo abre su lista completa (con la espera y las acciones). */}
                    <button type="button" onClick={() => elegirTardeo(f.tardeo_id)}
                      className="min-h-[32px] text-left font-semibold leading-tight text-magenta-700 underline-offset-2 hover:underline">
                      {f.tardeos?.titulo || "(tardeo borrado)"}
                    </button>
                    <p className="text-sm text-tinta-suave">
                      {f.tardeos?.fecha ? fechaCorta(f.tardeos.fecha) : "Sin fecha"}
                      {f.tardeos?.hora_inicio ? ` · ${f.tardeos.hora_inicio.slice(0, 5)}` : ""}
                      {f.tardeos?.locales?.nombre ? ` · ${f.tardeos.locales.nombre}` : ""}
                    </p>
                  </td>
                  <td className="md:px-4 md:py-3">
                    {/* Mover entre confirmado / espera / cancelado (lote 69, con rastro y
                        respetando el aforo). El admin de zona solo puede en su zona. */}
                    {soloLectura(f) && <p className="mb-1"><Etiqueta>Solo lectura</Etiqueta></p>}
                    <select value={f.estado} disabled={obrando === f.id || soloLectura(f)}
                      onChange={(e) => { const a = e.target.value as EstadoIns; if (a !== f.estado) setPorMover({ f, a }); }}
                      aria-label="Estado de la inscripción"
                      className={`min-h-[44px] rounded-lg border px-2 text-sm font-semibold ${f.estado === "apuntado" ? "border-ok text-ok" : "border-linea-fuerte"}`}>
                      <option value="apuntado">Apuntado</option>
                      <option value="espera">En espera</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                    {f.estado === "espera" && !soloLectura(f) && (
                      <button type="button" onClick={() => promover(f)} disabled={obrando === f.id}
                        className="mt-1 block min-h-[40px] text-sm font-semibold text-magenta-700 underline">
                        Promover al primero de la espera
                      </button>
                    )}
                  </td>
                  <td className="md:px-4 md:py-3">
                    {f.estado === "apuntado" && !sinAsistencia ? (
                      <div className="grid grid-cols-3 gap-1.5 md:flex" role="group" aria-label="Asistencia">
                        {([["pendiente", "Sin marcar"], ["asistio", "Vino"], ["no_asistio", "No vino"]] as [Asist, string][]).map(([v, t]) => {
                          const on = (f.asistencia ?? "pendiente") === v;
                          return (
                            <button key={v} type="button" onClick={() => marcar(f, v)} disabled={obrando === f.id || soloLectura(f)} aria-pressed={on}
                              className={`min-h-[44px] rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
                                on
                                  ? v === "asistio" ? "border-ok bg-ok text-white" : v === "no_asistio" ? "border-error bg-error text-white" : "border-tinta bg-tinta text-white"
                                  : "border-linea-fuerte bg-white text-tinta hover:bg-marfil-100"}`}>
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-sm text-tinta-suave">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
      </>)}

      {/* Mover a alguien cambia su plaza (y puede avisarle o subir a otro de la
          espera): se confirma antes, para que un toque sin querer no lo haga. */}
      <Hoja abierta={!!porMover} onCerrar={() => setPorMover(null)} titulo="¿Cambiar el estado?"
        pie={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="contorno" onClick={() => setPorMover(null)}>No, dejarlo</Boton>
            <Boton onClick={() => { const m = porMover; setPorMover(null); if (m) mover(m.f, m.a); }}>
              Sí, pasar a «{porMover ? NOMBRE_ESTADO[porMover.a] : ""}»
            </Boton>
          </div>
        }>
        {porMover && (
          <p className="text-[16px]">
            <b>{porMover.f.profiles?.display_name || "Tardícola"}</b> en «{porMover.f.tardeos?.titulo || "tardeo"}»
            pasa de <b>{NOMBRE_ESTADO[porMover.f.estado]}</b> a <b>{NOMBRE_ESTADO[porMover.a]}</b>.
            {porMover.f.estado === "apuntado" && porMover.a !== "apuntado" && " Su plaza queda libre y, si hay lista de espera, sube solo el primero."}
            {" "}Queda en la auditoría.
          </p>
        )}
      </Hoja>
    </SeccionPanel>
  );
}

/**
 * Buscar un tardeo por título para ver sus asistentes. Primero los de hoy en
 * adelante (lo que se gestiona), luego los pasados más recientes.
 */
function SelectorTardeo({ onElegir }: { onElegir: (id: string) => void }) {
  const [t, setT] = useState("");
  const q = useDiferido(t, 250);
  // Texto actual (sin esperar al diferido): si se eligió un tardeo mientras una
  // búsqueda seguía en camino, su respuesta no debe volver a abrir la lista.
  const actual = useRef("");
  useEffect(() => { actual.current = t; }, [t]);
  const [res, setRes] = useState<{ id: string; titulo: string | null; fecha: string | null; locales: { nombre: string | null } | null }[]>([]);
  useEffect(() => {
    const l = limpiar(q);
    if (l.length < 2) { setRes([]); return; }
    let vivo = true;
    const hoy = hoyMadrid();
    Promise.all([
      supabase.from("tardeos").select("id,titulo,fecha,locales(nombre)").ilike("titulo", `%${l}%`).gte("fecha", hoy).order("fecha").limit(6),
      supabase.from("tardeos").select("id,titulo,fecha,locales(nombre)").ilike("titulo", `%${l}%`).lt("fecha", hoy).order("fecha", { ascending: false }).limit(4),
    ]).then(([a, b]) => { if (vivo && limpiar(actual.current).length >= 2) setRes([...((a.data ?? []) as never[]), ...((b.data ?? []) as never[])]); });
    return () => { vivo = false; };
  }, [q]);
  return (
    <div className="relative mb-4">
      <label className="mb-1 block text-[15px] font-semibold">Ver los asistentes de un tardeo</label>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
        <input type="search" value={t} onChange={(e) => setT(e.target.value)} placeholder="Escribe el nombre del tardeo…"
          className="min-h-[48px] w-full rounded-xl border border-linea-fuerte bg-white pl-10 pr-3 text-[16px] outline-none focus:border-magenta focus:ring-4 focus:ring-magenta/15" />
      </div>
      {res.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-linea bg-white shadow-elevada">
          {res.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => { onElegir(r.id); setT(""); setRes([]); }}
                className="flex min-h-[48px] w-full flex-col items-start px-3 py-2 text-left hover:bg-marfil-100">
                <span className="text-[15px] font-semibold">{r.titulo || "Tardeo"}</span>
                <span className="text-sm text-tinta-suave">{r.fecha ? fechaCorta(r.fecha) : "Sin fecha"}{r.locales?.nombre ? ` · ${r.locales.nombre}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
