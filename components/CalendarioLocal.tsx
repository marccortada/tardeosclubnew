"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Tardeo } from "@/lib/types";
import { ChevronLeft, ChevronRight, Plus, Clock, Check, FileText } from "lucide-react";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Fecha local en YYYY-MM-DD. `toISOString()` daría el día anterior por la noche. */
const clave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const COLOR: Record<string, string> = {
  publicado: "bg-oro",
  programado: "bg-magenta",
  borrador: "bg-tinta/25",
  finalizado: "bg-tinta/15",
  cancelado: "bg-red-400",
};

/**
 * El mes de un local de un vistazo.
 *
 * Hasta ahora solo había una lista, y con quince tardeos al mes no se ve el
 * hueco: qué findes están cubiertos y cuáles no es justo lo que un local
 * necesita saber para programar.
 *
 * La semana empieza en lunes, no en domingo: aquí el finde va al final.
 */
export default function CalendarioLocal({ tardeos }: { tardeos: Tardeo[] }) {
  const hoy = new Date();
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));

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

  const mover = (n: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const hoyClave = clave(hoy);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => mover(-1)} aria-label="Mes anterior"
          className="grid h-10 w-10 place-items-center rounded-full text-tinta/50 transition hover:bg-black/5">
          <ChevronLeft size={20} />
        </button>
        <p className="font-display text-lg font-black capitalize">
          {MESES[mes.getMonth()]} {mes.getFullYear()}
        </p>
        <button onClick={() => mover(1)} aria-label="Mes siguiente"
          className="grid h-10 w-10 place-items-center rounded-full text-tinta/50 transition hover:bg-black/5">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS.map((d, i) => (
          <p key={i} className="pb-1 text-center text-xs font-black text-tinta/40">{d}</p>
        ))}

        {celdas.map((d, i) => {
          if (!d) return <div key={`h${i}`} />;
          const k = clave(d);
          const delDia = porDia.get(k) ?? [];
          const esHoy = k === hoyClave;
          const pasado = k < hoyClave;

          return (
            <Link
              key={k}
              // Al tocar un día vacío se crea con la fecha ya puesta: es lo que
              // se viene a hacer al mirar un hueco en el calendario.
              href={delDia.length ? `#dia-${k}` : `/local/crear?fecha=${k}`}
              className={`flex min-h-[54px] flex-col gap-1 rounded-xl p-1.5 transition ${
                esHoy ? "bg-magenta-50 ring-1 ring-magenta" : pasado ? "bg-black/[0.02]" : "hover:bg-magenta-50/60"
              }`}
            >
              <span className={`text-xs font-black ${esHoy ? "text-magenta" : pasado ? "text-tinta/30" : "text-tinta/60"}`}>
                {d.getDate()}
              </span>
              <span className="flex flex-wrap gap-0.5">
                {/* Un punto por tardeo, con el color de su estado. Más de tres
                    se resumen: en una celda de móvil no caben. */}
                {delDia.slice(0, 3).map((t) => (
                  <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${COLOR[t.estado ?? "publicado"] ?? "bg-tinta/25"}`} />
                ))}
                {delDia.length > 3 && <span className="text-[9px] font-black text-tinta/40">+{delDia.length - 3}</span>}
              </span>
              {!delDia.length && !pasado && (
                <Plus size={11} className="ml-auto mt-auto text-tinta/20" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-magenta-50 pt-3 text-xs font-bold text-tinta/50">
        <span className="inline-flex items-center gap-1.5"><Check size={12} className="text-oro-600" /> Publicado</span>
        <span className="inline-flex items-center gap-1.5"><Clock size={12} className="text-magenta" /> Programado</span>
        <span className="inline-flex items-center gap-1.5"><FileText size={12} className="text-tinta/40" /> Borrador</span>
      </div>
    </div>
  );
}
