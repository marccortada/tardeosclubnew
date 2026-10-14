"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Tardeo } from "@/lib/types";
import { getTardeosDeLocalEnRango } from "@/lib/tardeos";
import { ChevronLeft, ChevronRight, Plus, Pencil, Loader2 } from "lucide-react";
import { Etiqueta } from "@/components/ui/Chip";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Fecha local en YYYY-MM-DD. `toISOString()` daría el día anterior por la noche. */
const clave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const COLOR: Record<string, string> = {
  publicado: "bg-ok",
  programado: "bg-magenta",
  borrador: "bg-tinta/30",
  finalizado: "bg-tinta/20",
  cancelado: "bg-error",
};

export const NOMBRE_ESTADO: Record<string, { label: string; tono: "ok" | "marca" | "neutro" | "error" }> = {
  publicado: { label: "Publicado", tono: "ok" },
  programado: { label: "Programado", tono: "marca" },
  borrador: { label: "Borrador", tono: "neutro" },
  finalizado: { label: "Finalizado", tono: "neutro" },
  cancelado: { label: "Cancelado", tono: "error" },
};

/**
 * El mes de un local de un vistazo.
 *
 * Hasta ahora solo había una lista, y con quince tardeos al mes no se ve el
 * hueco: qué findes están cubiertos y cuáles no es justo lo que un local
 * necesita saber para programar.
 *
 * Pide SOLO el mes que enseña (antes recibía todos los tardeos del local, de
 * siempre). Al tocar un día con tardeos se listan debajo con su botón de
 * editar; un día vacío lleva a crear uno con la fecha ya puesta.
 *
 * La semana empieza en lunes, no en domingo: aquí el finde va al final.
 */
export default function CalendarioLocal({
  localId, enlace = (r) => r,
}: {
  localId: string;
  /** Añade el ?id= de la ficha a los enlaces cuando hace falta. */
  enlace?: (ruta: string) => string;
}) {
  const hoy = new Date();
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [tardeos, setTardeos] = useState<Tardeo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [dia, setDia] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const desde = clave(new Date(mes.getFullYear(), mes.getMonth(), 1));
    const hasta = clave(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    getTardeosDeLocalEnRango(localId, desde, hasta).then((t) => {
      if (!vivo) return;
      setTardeos(t);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [localId, mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, Tardeo[]>();
    for (const t of tardeos) {
      if (!m.has(t.fecha)) m.set(t.fecha, []);
      m.get(t.fecha)!.push(t);
    }
    return m;
  }, [tardeos]);

  const celdas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    // getDay(): 0 es domingo. Se convierte a "cuántos huecos antes del día 1"
    // con la semana empezando en lunes.
    const huecos = (primero.getDay() + 6) % 7;
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(huecos).fill(null);
    for (let d = 1; d <= ultimo; d++) out.push(new Date(mes.getFullYear(), mes.getMonth(), d));
    return out;
  }, [mes]);

  const mover = (n: number) => { setDia(null); setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1)); };
  const hoyClave = clave(hoy);
  const delDiaElegido = dia ? porDia.get(dia) ?? [] : [];

  return (
    <div className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => mover(-1)} aria-label="Mes anterior"
          className="grid h-11 w-11 place-items-center rounded-full text-tinta-suave transition hover:bg-marfil-100">
          <ChevronLeft size={20} />
        </button>
        <p className="flex items-center gap-2 text-lg font-bold" aria-live="polite">
          {MESES[mes.getMonth()].charAt(0).toUpperCase() + MESES[mes.getMonth()].slice(1)} {mes.getFullYear()}
          {cargando && <Loader2 size={16} className="animate-spin text-tinta-suave" aria-label="Cargando" />}
        </p>
        <button onClick={() => mover(1)} aria-label="Mes siguiente"
          className="grid h-11 w-11 place-items-center rounded-full text-tinta-suave transition hover:bg-marfil-100">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS.map((d, i) => (
          <p key={i} className="pb-1 text-center text-[13px] font-semibold text-tinta-suave">{d}</p>
        ))}

        {celdas.map((d, i) => {
          if (!d) return <div key={`h${i}`} />;
          const k = clave(d);
          const delDia = porDia.get(k) ?? [];
          const esHoy = k === hoyClave;
          const pasado = k < hoyClave;
          const elegido = k === dia;
          const cls = `flex min-h-[52px] flex-col gap-1 rounded-xl p-1.5 text-left transition ${
            elegido ? "bg-tinta text-white" : esHoy ? "bg-magenta-50 ring-1 ring-magenta" : pasado ? "bg-marfil" : "hover:bg-marfil-100"
          }`;
          const contenido = (
            <>
              <span className={`text-[13px] font-semibold ${elegido ? "text-white" : esHoy ? "text-magenta-700" : "text-tinta-suave"}`}>
                {d.getDate()}
              </span>
              <span className="flex flex-wrap gap-0.5">
                {/* Un punto por tardeo, con el color de su estado. Más de tres
                    se resumen: en una celda de móvil no caben. */}
                {delDia.slice(0, 3).map((t) => (
                  <span key={t.id} className={`h-2 w-2 rounded-full ${COLOR[t.estado ?? "publicado"] ?? "bg-tinta/30"}`} />
                ))}
                {delDia.length > 3 && <span className="text-[11px] font-bold">+{delDia.length - 3}</span>}
              </span>
              {!delDia.length && !pasado && (
                <Plus size={12} className="ml-auto mt-auto text-tinta-suave" aria-hidden />
              )}
            </>
          );
          // Al tocar un día vacío se crea con la fecha ya puesta: es lo que
          // se viene a hacer al mirar un hueco en el calendario.
          return delDia.length ? (
            <button key={k} type="button" onClick={() => setDia(elegido ? null : k)} className={cls}
              aria-label={`${d.getDate()}: ${delDia.length} ${delDia.length === 1 ? "tardeo" : "tardeos"}`} aria-pressed={elegido}>
              {contenido}
            </button>
          ) : pasado ? (
            <div key={k} className={cls}>{contenido}</div>
          ) : (
            <Link key={k} href={enlace(`/local/crear?fecha=${k}`)} className={cls} aria-label={`Crear un tardeo el ${d.getDate()}`}>
              {contenido}
            </Link>
          );
        })}
      </div>

      {dia && delDiaElegido.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-linea pt-3">
          {delDiaElegido.map((t) => {
            const e = NOMBRE_ESTADO[t.estado ?? "publicado"] ?? NOMBRE_ESTADO.borrador;
            return (
              <li key={t.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{t.titulo}</p>
                  <p className="flex items-center gap-2 text-sm text-tinta-suave">
                    {t.horaInicio?.slice(0, 5)} <Etiqueta tono={e.tono}>{e.label}</Etiqueta>
                  </p>
                </div>
                <Link href={enlace(`/local/tardeos/${t.id}/editar`)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-linea-fuerte px-3 text-[15px] font-semibold hover:bg-marfil-100">
                  <Pencil size={16} aria-hidden /> Editar
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-4 border-t border-linea pt-3 text-[13px] font-medium text-tinta-suave">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ok" /> Publicado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-magenta" /> Programado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-tinta/30" /> Borrador</span>
        <span className="inline-flex items-center gap-1.5"><Plus size={12} aria-hidden /> Toca un día libre para crear</span>
      </div>
    </div>
  );
}
