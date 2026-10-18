"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, CalendarDays, List } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, Filtros, EstadoLista, Buscador, useDiferido } from "@/components/panel/Paginacion";
import PanelFiltros, { RangoFechas } from "@/components/panel/PanelFiltros";
import { claseBoton } from "@/components/Boton";
import CalendarioLocal from "@/components/CalendarioLocal";
import { useFicha } from "../_panel/PanelLocal";
import FilaTardeo from "../_panel/FilaTardeo";
import { getTardeosDeLocal, contarTardeosDeLocal, type FiltroTardeos } from "@/lib/tardeos";

const FILTROS: { clave: FiltroTardeos; label: string; vacio: string }[] = [
  { clave: "proximos", label: "Próximos", vacio: "No tienes tardeos próximos. Crea uno y saldrá aquí." },
  { clave: "pasados", label: "Pasados", vacio: "Todavía no hay tardeos pasados." },
  { clave: "borradores", label: "Borradores", vacio: "No tienes nada guardado sin publicar." },
  { clave: "cerrados", label: "Cancelados y finalizados", vacio: "No tienes tardeos cancelados ni finalizados." },
];

/**
 * Todos los tardeos del local, de 25 en 25 y separados en tres pestañas.
 *
 * Antes era una sola lista con TODOS los tardeos de siempre (el paraguas
 * TardeosClub tiene casi 400) mezclando lo de este finde con lo del año
 * pasado. Ahora se piden por páginas al servidor, y el calendario del mes va
 * aparte para ver de un vistazo qué findes están cubiertos.
 */
export default function MisTardeos() {
  const { ficha, enlace } = useFicha();
  const [filtro, setFiltro] = useState<FiltroTardeos>("proximos");
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [cuentas, setCuentas] = useState<Record<FiltroTardeos, number | null> | null>(null);

  // Se puede llegar con ?filtro=borradores desde el resumen. Se lee al montar
  // y no con useSearchParams, que obliga a un Suspense alrededor.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filtro");
    if (f === "pasados" || f === "borradores" || f === "proximos" || f === "cerrados") setFiltro(f);
  }, []);

  useEffect(() => {
    let vivo = true;
    contarTardeosDeLocal(ficha.id).then((c) => vivo && setCuentas(c));
    return () => { vivo = false; };
  }, [ficha.id]);

  // Buscar por título y acotar fechas (en el servidor: la lista va paginada).
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const activos = [fDesde, fHasta].filter(Boolean).length;

  const p = usePaginado(
    (desde, hasta) => getTardeosDeLocal(ficha.id, filtro, desde, hasta, { texto: busca, desde: fDesde, hasta: fHasta }),
    [ficha.id, filtro, busca, fDesde, fHasta],
  );

  const actual = FILTROS.find((f) => f.clave === filtro)!;

  return (
    <SeccionPanel
      titulo="Mis tardeos"
      descripcion="Todo lo que has publicado, programado o guardado."
      acciones={
        <Link href={enlace("/local/crear")} className={claseBoton("primario", "pequeno")}>
          <Plus size={18} aria-hidden /> Crear tardeo
        </Link>
      }
    >
      {/* En el móvil no caben lista y calendario a la vez: se elige. En
          escritorio van uno al lado del otro. */}
      <div className="mb-4 flex gap-2 lg:hidden" role="tablist" aria-label="Vista">
        {([["lista", "Lista", List], ["calendario", "Calendario", CalendarDays]] as const).map(([k, label, Icono]) => (
          <button key={k} role="tab" aria-selected={vista === k} onClick={() => setVista(k)}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border text-[15px] font-semibold ${
              vista === k ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white"}`}>
            <Icono size={18} aria-hidden /> {label}
          </button>
        ))}
      </div>

      {/* grid-cols-1 + min-w-0: sin ellos, en móvil la columna medía lo que
          la fila de filtros (que se desliza) y la página tenía scroll lateral. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className={vista === "lista" ? "min-w-0" : "hidden lg:block"}>
          <Filtros
            opciones={FILTROS.map((f) => ({ clave: f.clave, label: f.label, n: cuentas?.[f.clave] }))}
            valor={filtro}
            onCambiar={setFiltro}
          />
          <div className="mt-3 flex flex-col gap-3">
            <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar por título…" />
            <PanelFiltros clave="local-tardeos" activos={activos} onLimpiar={() => { setFDesde(""); setFHasta(""); }}>
              <RangoFechas desde={fDesde} hasta={fHasta} onDesde={setFDesde} onHasta={setFHasta} etiqueta="Fecha del tardeo" />
            </PanelFiltros>
          </div>
          <div className="mt-4">
            <EstadoLista cargando={p.cargando} error={p.error} vacio={busca || activos ? "Ningún tardeo con esa búsqueda o fechas." : actual.vacio} filas={p.filas.length} />
            {p.filas.length > 0 && (
              <ul className={`flex flex-col gap-2 transition-opacity ${p.cargando ? "opacity-60" : ""}`}>
                {p.filas.map((t) => <FilaTardeo key={t.id} t={t} enlace={enlace} />)}
              </ul>
            )}
            <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
          </div>
        </div>

        <aside className={vista === "calendario" ? "" : "hidden lg:block"} aria-label="Calendario del mes">
          {/* El calendario va aparte de la lista: con quince tardeos al mes,
              la lista no deja ver qué findes están cubiertos y cuáles no, que
              es lo que hace falta para decidir qué programar. */}
          <div className="lg:sticky lg:top-6">
            <CalendarioLocal localId={ficha.id} enlace={enlace} />
          </div>
        </aside>
      </div>
    </SeccionPanel>
  );
}
