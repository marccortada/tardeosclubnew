"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { claseCampo } from "@/components/ui/Campo";

/**
 * Filtros plegables para las listas de los paneles.
 *
 * Por qué: pantallas como Tardeos o Asistencias acumulaban buscador, zona y dos
 * filas de pestañas; en el móvil la lista empezaba a media pantalla. Aquí los
 * filtros "de más" van dentro de un bloque que se abre y se cierra con un botón
 * «Filtros (n)», donde n = cuántos hay puestos, para que nunca se olvide uno
 * activo. El estado abierto/cerrado se recuerda por pantalla (`clave`) en este
 * navegador: quien los usa siempre los encuentra abiertos.
 *
 * Uso:
 *   <PanelFiltros clave="admin-tardeos" activos={n} onLimpiar={limpiar}>
 *     <CampoFiltro etiqueta="Desde"><input type="date" …/></CampoFiltro>
 *     …
 *   </PanelFiltros>
 */
export default function PanelFiltros({ clave, activos, onLimpiar, children, titulo = "Filtros" }: {
  clave: string; activos: number; onLimpiar?: () => void; children: ReactNode; titulo?: string;
}) {
  const id = `filtros-${clave}`;
  const [abierto, setAbierto] = useState(false);
  // Se lee después de montar: en el servidor no hay localStorage y así no
  // cambia el HTML entre servidor y navegador.
  useEffect(() => {
    try { setAbierto(localStorage.getItem(`tc_${id}`) === "1"); } catch { /* sin almacenamiento: cerrado */ }
  }, [id]);
  const cambiar = () => {
    setAbierto((a) => {
      try { localStorage.setItem(`tc_${id}`, a ? "0" : "1"); } catch { /* da igual */ }
      return !a;
    });
  };

  return (
    <div className="rounded-2xl border border-linea bg-white">
      <div className="flex items-center gap-2 px-2">
        <button type="button" onClick={cambiar} aria-expanded={abierto} aria-controls={id}
          className="flex min-h-[48px] flex-1 items-center gap-2 px-2 text-left text-[15px] font-semibold text-tinta">
          <SlidersHorizontal size={18} className="text-magenta" aria-hidden />
          {titulo}
          {activos > 0 && (
            <span className="rounded-full bg-magenta px-2 text-[13px] font-bold leading-[22px] text-white">{activos}</span>
          )}
          <ChevronDown size={18} aria-hidden className={`ml-auto text-tinta-suave transition-transform ${abierto ? "rotate-180" : ""}`} />
        </button>
        {activos > 0 && onLimpiar && (
          <button type="button" onClick={onLimpiar}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-[14px] font-semibold text-magenta-700 hover:bg-magenta-50">
            <X size={16} aria-hidden /> Quitar
          </button>
        )}
      </div>
      {abierto && (
        <div id={id} className="grid gap-3 border-t border-linea p-3 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Etiqueta + control, con el mismo aspecto en todos los paneles. */
export function CampoFiltro({ etiqueta, children, ancho }: { etiqueta: string; children: ReactNode; ancho?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-[14px] font-semibold text-tinta-suave ${ancho ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      {etiqueta}
      {children}
    </label>
  );
}

/** Clase de los <select>/<input> dentro del panel (algo más bajos que en formularios). */
// text-base (16 px): por debajo, Safari de iPhone hace zoom al tocar el campo.
export const claseFiltro = `${claseCampo} !min-h-[44px] !py-2 text-base`;

/** Selector de orden reutilizable. */
export function SelectorOrden<K extends string>({ valor, onCambiar, opciones }: {
  valor: K; onCambiar: (k: K) => void; opciones: { clave: K; label: string }[];
}) {
  return (
    <CampoFiltro etiqueta="Ordenar por">
      <select value={valor} onChange={(e) => onCambiar(e.target.value as K)} className={claseFiltro}>
        {opciones.map((o) => <option key={o.clave} value={o.clave}>{o.label}</option>)}
      </select>
    </CampoFiltro>
  );
}

/** Rango de fechas (desde / hasta) en dos campos. Valores 'YYYY-MM-DD' o "". */
export function RangoFechas({ desde, hasta, onDesde, onHasta, etiqueta = "Fecha" }: {
  desde: string; hasta: string; onDesde: (v: string) => void; onHasta: (v: string) => void; etiqueta?: string;
}) {
  return (
    <>
      <CampoFiltro etiqueta={`${etiqueta}: desde`}>
        <input type="date" value={desde} max={hasta || undefined} onChange={(e) => onDesde(e.target.value)} className={claseFiltro} />
      </CampoFiltro>
      <CampoFiltro etiqueta={`${etiqueta}: hasta`}>
        <input type="date" value={hasta} min={desde || undefined} onChange={(e) => onHasta(e.target.value)} className={claseFiltro} />
      </CampoFiltro>
    </>
  );
}
