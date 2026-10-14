"use client";

import { useEffect, useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { claseCampo } from "@/components/ui/Campo";
import { supabase } from "@/lib/supabase";
import { marcarAsistencia } from "@/lib/tardeos";
import { Download, Users, CheckCircle2, XCircle, Clock, X } from "lucide-react";

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
type Estado = "todos" | "apuntado" | "cancelado";
type Periodo = "todos" | "proximos" | "pasados";
type BuscarEn = "persona" | "tardeo";

type Bruta = {
  id: string; estado: "apuntado" | "cancelado"; asistencia?: Asist | null; created_at: string;
  profiles: { display_name: string | null; email: string | null } | null;
  tardeos: { titulo: string | null; fecha: string | null; hora_inicio: string | null; locales: { nombre: string | null } | null } | null;
};

type Filtro = { estado: Estado; asist: "todas" | Asist; periodo: Periodo; dia: string; busca: string; buscaEn: BuscarEn; sinAsistencia: boolean };

const hoyMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
const fechaCorta = (f: string) =>
  new Date(f + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
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
 * PostgREST deja la fila y solo vacía el objeto anidado.
 */
function consulta(f: Filtro, contar: boolean) {
  const porPersona = !!f.busca && f.buscaEn === "persona";
  const porTardeo = (!!f.busca && f.buscaEn === "tardeo") || f.periodo !== "todos" || !!f.dia;
  const cols = [
    "id,estado,created_at",
    f.sinAsistencia ? "" : "asistencia",
    `profiles${porPersona ? "!inner" : ""}(display_name,email)`,
    `tardeos${porTardeo ? "!inner" : ""}(titulo,fecha,hora_inicio,locales(nombre))`,
  ].filter(Boolean).join(",");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- la select se arma en tiempo de ejecución y el tipado de supabase-js no la sigue
  let q: any = supabase.from("inscripciones").select(cols, contar ? { count: "exact" } : undefined);
  if (f.estado !== "todos") q = q.eq("estado", f.estado);
  if (!f.sinAsistencia && f.asist !== "todas") q = q.eq("asistencia", f.asist);
  if (f.dia) q = q.eq("tardeos.fecha", f.dia);
  else if (f.periodo === "proximos") q = q.gte("tardeos.fecha", hoyMadrid());
  else if (f.periodo === "pasados") q = q.lt("tardeos.fecha", hoyMadrid());
  const l = limpiar(f.busca);
  if (l && f.buscaEn === "persona") q = q.or(`display_name.ilike.%${l}%,email.ilike.%${l}%`, { referencedTable: "profiles" });
  if (l && f.buscaEn === "tardeo") q = q.ilike("tardeos.titulo", `%${l}%`);
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
  const [dia, setDia] = useState("");
  const [asist, setAsist] = useState<"todas" | Asist>("todas");
  const [sinAsistencia, setSinAsistencia] = useState(false);
  const [resumen, setResumen] = useState<{ apuntados?: number; asistio?: number; no_asistio?: number; pendiente?: number }>({});
  const [obrando, setObrando] = useState<string | null>(null);
  const [exportando, setExportando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const filtro: Filtro = { estado, asist, periodo, dia, busca, buscaEn, sinAsistencia };

  const p = usePaginado<Bruta>(
    (desde, hasta) =>
      (consulta(filtro, true).range(desde, hasta) as PromiseLike<{ data: Bruta[] | null; count: number | null; error: unknown }>).then((r) => {
        // Sin el lote 48 no existe la columna `asistencia`: se repite sin ella.
        // (Se devuelve vacío sin error para que no parpadee un fallo mientras.)
        if (r.error && !sinAsistencia && esColumnaQueFalta(r.error)) {
          setSinAsistencia(true);
          return { data: [], count: 0, error: null };
        }
        return r;
      }),
    [estado, asist, periodo, dia, busca, buscaEn, sinAsistencia],
    25,
  );

  // Resumen global (no depende de los filtros): solo recuentos, sin filas.
  const contar = () => {
    const base = () => supabase.from("inscripciones").select("id", { count: "exact", head: true }).eq("estado", "apuntado");
    Promise.all([
      base(),
      sinAsistencia ? null : base().eq("asistencia", "asistio"),
      sinAsistencia ? null : base().eq("asistencia", "no_asistio"),
      sinAsistencia ? null : base().eq("asistencia", "pendiente"),
    ]).then(([a, b, c, d]) => setResumen({
      apuntados: a.count ?? undefined, asistio: b?.count ?? undefined, no_asistio: c?.count ?? undefined, pendiente: d?.count ?? undefined,
    }));
  };
  useEffect(contar, [sinAsistencia]);

  const marcar = async (f: Bruta, valor: Asist) => {
    if (f.asistencia === valor) return;
    setObrando(f.id); setError(""); setOk("");
    const { error: e } = await marcarAsistencia(f.id, valor);
    setObrando(null);
    if (e) { setError("No se pudo guardar la asistencia: " + e.message); return; }
    p.cambiar((x) => x.id === f.id, { asistencia: valor });
    contar();
  };

  const exportarCsv = async () => {
    setExportando(0); setError(""); setOk("");
    const todas: Bruta[] = [];
    // Por lotes de 1000 (el tope de PostgREST por petición), hasta agotar.
    for (let desde = 0; desde < 100000; desde += 1000) {
      const { data, error: e } = await consulta(filtro, false).range(desde, desde + 999);
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
      f.estado === "apuntado" ? "Apuntado" : "Cancelado",
      f.asistencia ? nombreAsist[f.asistencia] : "", new Date(f.created_at).toLocaleString("es-ES"),
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

  const hayFiltros = !!busca || estado !== "apuntado" || periodo !== "todos" || !!dia || asist !== "todas";
  const limpiarFiltros = () => { setTexto(""); setEstado("apuntado"); setPeriodo("todos"); setDia(""); setAsist("todas"); };

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
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Resumen de todas las inscripciones">
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

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Buscador valor={texto} onCambiar={setTexto}
            placeholder={buscaEn === "persona" ? "Buscar persona por nombre o email…" : "Buscar por título del tardeo…"} />
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
            { clave: "cancelado", label: "Cancelados" },
            { clave: "todos", label: "Todos" },
          ]}
        />

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <Filtros<Periodo>
            valor={dia ? ("" as Periodo) : periodo}
            onCambiar={(v) => { setPeriodo(v); setDia(""); }}
            opciones={[
              { clave: "todos", label: "Cualquier fecha" },
              { clave: "proximos", label: "Próximos" },
              { clave: "pasados", label: "Pasados" },
            ]}
          />
          <label className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="shrink-0">Día del tardeo</span>
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className={`${claseCampo} !min-h-[44px] !py-2 md:w-auto`} />
          </label>
        </div>

        {!sinAsistencia && (
          <Filtros<"todas" | Asist>
            valor={asist}
            onCambiar={setAsist}
            opciones={[
              { clave: "todas", label: "Toda asistencia" },
              { clave: "pendiente", label: "Sin marcar" },
              { clave: "asistio", label: "Vinieron" },
              { clave: "no_asistio", label: "No vinieron" },
            ]}
          />
        )}

        {hayFiltros && (
          <button type="button" onClick={limpiarFiltros}
            className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-lg px-2 text-[15px] font-semibold text-magenta-700 hover:bg-magenta-50">
            <X size={16} aria-hidden /> Quitar filtros
          </button>
        )}
      </div>

      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio={hayFiltros ? "Ninguna inscripción con esos filtros." : "Todavía no se ha apuntado nadie."} />

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
                    <p className="font-semibold leading-tight">{f.tardeos?.titulo || "(tardeo borrado)"}</p>
                    <p className="text-sm text-tinta-suave">
                      {f.tardeos?.fecha ? fechaCorta(f.tardeos.fecha) : "Sin fecha"}
                      {f.tardeos?.hora_inicio ? ` · ${f.tardeos.hora_inicio.slice(0, 5)}` : ""}
                      {f.tardeos?.locales?.nombre ? ` · ${f.tardeos.locales.nombre}` : ""}
                    </p>
                  </td>
                  <td className="md:px-4 md:py-3">
                    <Etiqueta tono={f.estado === "apuntado" ? "ok" : "neutro"}>{f.estado === "apuntado" ? "Apuntado" : "Cancelado"}</Etiqueta>
                  </td>
                  <td className="md:px-4 md:py-3">
                    {f.estado === "apuntado" && !sinAsistencia ? (
                      <div className="grid grid-cols-3 gap-1.5 md:flex" role="group" aria-label="Asistencia">
                        {([["pendiente", "Sin marcar"], ["asistio", "Vino"], ["no_asistio", "No vino"]] as [Asist, string][]).map(([v, t]) => {
                          const on = (f.asistencia ?? "pendiente") === v;
                          return (
                            <button key={v} type="button" onClick={() => marcar(f, v)} disabled={obrando === f.id} aria-pressed={on}
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
    </SeccionPanel>
  );
}
