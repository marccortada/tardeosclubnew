"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Users, ChevronUp, Info, ClipboardCheck } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { Filtros, Buscador, EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import { useFicha } from "../_panel/PanelLocal";
import { getInscritosLocal, hoyISO, type InscritoLocal } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import { plegar } from "@/lib/texto";
import PasarLista, { cargarLista } from "../_panel/PasarLista";

type Grupo = { id: string; titulo: string; fecha: string; filas: InscritoLocal[] };
type Periodo = "proximos" | "pasados";

const POR_PAGINA = 25;
const VISIBLES = 12;

/**
 * Una celda de CSV a prueba de Excel.
 *
 * El nombre lo escribe cada tardícola en su perfil: alguien que se llame
 * «=HYPERLINK(...)» convertiría la hoja del local en una trampa al abrirla.
 * Lo que empieza por = + - @ (o tabulador / retorno) se precede de un
 * apóstrofo, que Excel y LibreOffice muestran como texto.
 */
const celda = (v: string) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const NOMBRE_ASIST: Record<string, string> = { pendiente: "Sin marcar", asistio: "Vino", no_asistio: "No vino" };

/**
 * El CSV, con la columna de asistencia cuando existe (lote 48). Para tenerla
 * se pide la lista de cada tardeo: son pocas filas y así lo descargado coincide
 * con lo marcado, aunque no se haya abierto «Pasar lista».
 */
async function descargarCsv(nombre: string, grupos: Grupo[]) {
  const listas = await Promise.all(grupos.map((g) => cargarLista(g.id)));
  const conAsist = listas.length > 0 && listas.every((l) => !l.error);
  const cab = ["Tardeo", "Fecha", "Nombre", "Apuntado el", ...(conAsist ? ["Asistencia"] : [])];
  const fecha = (iso: string) => (iso ? new Date(iso).toLocaleString("es-ES") : "");
  const filas = grupos.flatMap((g, i) => conAsist
    ? listas[i].filas.map((f) => [g.titulo, g.fecha, f.nombre, fecha(f.apuntado_en), NOMBRE_ASIST[f.asistencia] ?? ""].map(celda).join(";"))
    : g.filas.map((f) => [g.titulo, g.fecha, f.nombre, fecha(f.apuntado_en)].map(celda).join(";")));
  // BOM + punto y coma: Excel en español lo abre con acentos y columnas bien.
  const blob = new Blob(["﻿" + [cab.map(celda).join(";"), ...filas].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) => plegar(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "tardeo";

/**
 * Quién se ha apuntado a los tardeos gratis del local (botón «Apuntarme»).
 *
 * Antes era un bloque al final del panel, con todos los nombres de todos los
 * tardeos de siempre mezclados. Aquí va por tardeo, separado en próximos y
 * pasados, con el número bien visible (es lo que sirve para preparar barra y
 * personal) y una exportación a CSV para la lista de la puerta.
 */
export default function Apuntados() {
  const { ficha, ajena, enlace } = useFicha();
  const [filas, setFilas] = useState<InscritoLocal[] | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("proximos");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [pedido, setPedido] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setFilas(null); setErrorCarga(null);
    getInscritosLocal(ficha.id).then((r) => {
      if (!vivo) return;
      setFilas(r.filas);
      setErrorCarga(r.error);
    });
    return () => { vivo = false; };
  }, [ficha.id, intento]);

  // ?tardeo=<id> desde "Mis tardeos": se abre ese y se pone en su pestaña.
  useEffect(() => {
    setPedido(new URLSearchParams(window.location.search).get("tardeo"));
  }, []);

  const hoy = hoyISO();
  const grupos = useMemo(() => {
    const m = new Map<string, Grupo>();
    for (const f of filas ?? []) {
      if (!m.has(f.tardeo_id)) m.set(f.tardeo_id, { id: f.tardeo_id, titulo: f.tardeo_titulo, fecha: f.fecha, filas: [] });
      m.get(f.tardeo_id)!.filas.push(f);
    }
    return [...m.values()];
  }, [filas]);

  useEffect(() => {
    if (!pedido || !filas) return;
    const g = grupos.find((x) => x.id === pedido);
    if (g) {
      setPeriodo(g.fecha >= hoy ? "proximos" : "pasados");
      setAbiertos((s) => new Set(s).add(g.id));
    }
  }, [pedido, filas, grupos, hoy]);

  const proximos = grupos.filter((g) => g.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pasados = grupos.filter((g) => g.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const lista = (periodo === "proximos" ? proximos : pasados)
    .filter((g) => !busca.trim() || plegar(g.titulo).includes(plegar(busca.trim())));
  const pag = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const totalPersonas = lista.reduce((s, g) => s + g.filas.length, 0);
  const pedidoSinNadie = pedido && filas && !errorCarga && !grupos.some((g) => g.id === pedido);

  useEffect(() => { setPagina(1); }, [periodo, busca]);

  const [exportando, setExportando] = useState<string | null>(null);
  const [errorCsv, setErrorCsv] = useState("");
  const exportar = async (clave: string, nombre: string, gs: Grupo[]) => {
    setExportando(clave); setErrorCsv("");
    try { await descargarCsv(nombre, gs); } catch { setErrorCsv("No se pudo preparar el CSV. Inténtalo otra vez."); }
    setExportando(null);
  };

  const alternar = (id: string) => setAbiertos((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <SeccionPanel
      titulo="Apuntados"
      descripcion="Quién se ha apuntado a tus tardeos gratis con el botón «Apuntarme»."
      acciones={
        <Boton tamano="pequeno" variante="contorno" disabled={lista.length === 0} cargando={exportando === "todo"}
          onClick={() => exportar("todo", `apuntados-${periodo}-${hoy}.csv`, lista)}>
          {exportando !== "todo" && <Download size={18} aria-hidden />} Exportar CSV
        </Boton>
      }
    >
      {ajena && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-aviso/25 bg-aviso-fondo p-4 text-[15px] text-aviso">
          <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
          Como administrador solo verás apuntados aquí cuando esté pegado el SQL
          «50_panel_local_admin.sql». Mientras, cada tardeo enseña los suyos en su ficha de edición.
        </p>
      )}

      {errorCsv && <p role="alert" className="mb-4 rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{errorCsv}</p>}

      {pedidoSinNadie && (
        <p className="mb-4 rounded-xl border border-linea bg-white p-4 text-[15px] text-tinta-suave">
          Ese tardeo todavía no tiene a nadie apuntado.
        </p>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Filtros
          opciones={[
            { clave: "proximos" as Periodo, label: "Próximos", n: filas ? proximos.length : null },
            { clave: "pasados" as Periodo, label: "Pasados", n: filas ? pasados.length : null },
          ]}
          valor={periodo}
          onCambiar={setPeriodo}
        />
        <Buscador valor={busca} onCambiar={setBusca} placeholder="Buscar por tardeo…" />
      </div>

      {filas && lista.length > 0 && (
        <p className="mt-4 text-[15px] text-tinta-suave">
          <b className="text-tinta">{totalPersonas}</b> {totalPersonas === 1 ? "persona apuntada" : "personas apuntadas"} en{" "}
          <b className="text-tinta">{lista.length}</b> {lista.length === 1 ? "tardeo" : "tardeos"}.
        </p>
      )}

      <div className="mt-4">
        <EstadoLista
          cargando={filas === null}
          error={errorCarga}
          vacio={busca ? "Ningún tardeo con ese nombre." : periodo === "proximos"
            ? "Nadie apuntado todavía a tus próximos tardeos. Los gratis tienen botón «Apuntarme»: compártelos para que se vaya llenando."
            : "Ningún tardeo pasado con apuntados."}
          filas={lista.length}
        />
        {errorCarga && (
          <button type="button" onClick={() => setIntento((n) => n + 1)}
            className="mt-2 inline-flex min-h-[44px] items-center text-[15px] font-bold text-magenta-700">
            Reintentar
          </button>
        )}

        {pag.length > 0 && (
          <ul className="flex flex-col gap-3">
            {pag.map((g) => {
              const abierto = abiertos.has(g.id);
              const nombres = g.filas.slice(0, VISIBLES);
              return (
                <li key={g.id} id={`t-${g.id}`}
                  className={`rounded-2xl border bg-white p-4 shadow-tarjeta ${pedido === g.id ? "border-magenta" : "border-linea"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-tinta-suave">{formatFecha(g.fecha)}</p>
                      <h2 className="text-[17px] font-bold leading-tight">{g.titulo}</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-magenta-50 px-3 text-[16px] font-bold text-magenta-700">
                        <Users size={18} aria-hidden /> {g.filas.length}
                      </span>
                      <button type="button" disabled={exportando === g.id} onClick={() => exportar(g.id, `apuntados-${slug(g.titulo)}-${g.fecha}.csv`, [g])}
                        aria-label={`Exportar CSV de ${g.titulo}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-linea-fuerte px-3 text-[15px] font-semibold hover:bg-marfil-100 disabled:opacity-60">
                        <Download size={16} aria-hidden /> {exportando === g.id ? "Preparando…" : "CSV"}
                      </button>
                      <Link href={enlace(`/local/tardeos/${g.id}/editar`)}
                        className="hidden min-h-[44px] items-center rounded-xl border border-linea-fuerte px-3 text-[15px] font-semibold hover:bg-marfil-100 sm:inline-flex">
                        Ver tardeo
                      </Link>
                    </div>
                  </div>
                  {/* Cerrado: los nombres de un vistazo. Abierto: la lista
                      entera con los botones de asistencia. */}
                  {abierto ? (
                    <div className="mt-3">
                      <PasarLista tardeoId={g.id} nombresRespaldo={g.filas.map((f) => f.nombre)} />
                    </div>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Apuntados a ${g.titulo}`}>
                      {nombres.map((n, i) => (
                        <li key={i} className="rounded-full bg-marfil-100 px-3 py-1 text-[15px] font-medium">{n.nombre}</li>
                      ))}
                      {g.filas.length > VISIBLES && <li className="px-2 py-1 text-[15px] text-tinta-suave">y {g.filas.length - VISIBLES} más</li>}
                    </ul>
                  )}
                  <button type="button" onClick={() => alternar(g.id)} aria-expanded={abierto}
                    className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-magenta-700">
                    {abierto
                      ? <><ChevronUp size={16} aria-hidden /> Cerrar la lista</>
                      : <><ClipboardCheck size={16} aria-hidden /> Pasar lista (quién vino)</>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Paginacion pagina={pagina} total={lista.length} porPagina={POR_PAGINA} onCambiar={setPagina} />
      </div>
    </SeccionPanel>
  );
}
