"use client";

import { Repeat, CalendarRange, AlertTriangle } from "lucide-react";
import {
  FRECUENCIAS, fechasDeSerie, fechaCorta, llegaAlTope, MAXIMO, esFecha, masMeses,
  type Periodicidad,
} from "@/lib/periodicidad";

/**
 * Atajos para el «hasta cuándo».
 *
 * La previsualización no puede calcularse sin fecha de fin, así que hasta que
 * no se elegía una el recuadro solo decía «elige hasta cuándo». Quien viene a
 * repetir un tardeo de los sábados no tiene una fecha de fin en la cabeza:
 * tiene un "hasta el verano". Con esto la previsualización aparece de un toque.
 */
const ATAJOS = [
  { meses: 1, label: "1 mes" },
  { meses: 3, label: "3 meses" },
  { meses: 6, label: "6 meses" },
];

/**
 * Cada cuánto se repite el tardeo.
 *
 * ENSEÑA LAS FECHAS ANTES DE CREARLAS, y ése es el punto. Cada repetición es un
 * tardeo independiente: si salen mal, hay que corregirlas una a una. Un
 * desplegable que dijera solo "cada semana hasta el 30" te deja darle al botón
 * sin saber si son cuatro o cinco, ni si la última cae en el puente.
 */
export default function PeriodicidadTardeo({
  fecha,
  valor,
  onCambio,
}: {
  /** La fecha del tardeo. Sin ella no hay serie que calcular. */
  fecha: string;
  valor: Periodicidad;
  onCambio: (p: Periodicidad) => void;
}) {
  const fechas = fechasDeSerie(fecha, valor);
  const repite = valor.cada !== "una";
  const tope = llegaAlTope(fecha, valor);
  // Con fecha puesta pero ilegible no se puede calcular nada, y hay que
  // decirlo con esas palabras. Pasa cuando la IA lee un flyer y escribe
  // "07/09/2026": el campo se queda vacío en pantalla pero el estado no.
  const fechaMala = Boolean(fecha) && !esFecha(fecha);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
      <p className="mb-2 flex items-center gap-2 text-sm font-black text-tinta/70">
        <Repeat size={16} className="text-magenta" /> ¿Se repite?
      </p>

      <div className="flex flex-wrap gap-1.5">
        {FRECUENCIAS.map((f) => (
          <button
            key={f.k}
            type="button"
            onClick={() => onCambio({ ...valor, cada: f.k })}
            title={f.pie}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              valor.cada === f.k
                ? "bg-marca text-white"
                : "bg-black/5 text-tinta/50 hover:bg-black/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {repite && (
        <>
          <label className="mt-3 block">
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
              <CalendarRange size={15} className="text-magenta" /> Hasta el
            </span>
            <input
              type="date"
              value={valor.hasta}
              min={fecha || undefined}
              onChange={(e) => onCambio({ ...valor, hasta: e.target.value })}
              className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-magenta"
            />
          </label>

          {/* Lo que va a pasar, en fechas de verdad. */}
          <div className="mt-3 rounded-xl bg-magenta-50/60 p-3">
            {!fecha ? (
              <p className="text-sm font-bold text-tinta/60">
                Pon primero la fecha del tardeo y aquí verás los días que se crean.
              </p>
            ) : fechaMala ? (
              <p className="flex items-start gap-1.5 text-sm font-bold text-magenta">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                La fecha del tardeo no se entiende. Vuelve a ponerla arriba y aquí
                verás los días que se crean.
              </p>
            ) : !valor.hasta ? (
              <>
                <p className="text-sm font-bold text-tinta/60">
                  Elige hasta cuándo y aquí verás los días que se crean.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ATAJOS.map((a) => (
                    <button
                      key={a.meses} type="button"
                      onClick={() => onCambio({ ...valor, hasta: masMeses(fecha, a.meses) })}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-magenta ring-1 ring-magenta-100 transition hover:bg-magenta-50"
                    >{a.label}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-tinta">
                  Se crearán {fechas.length} {fechas.length === 1 ? "tardeo" : "tardeos"}:
                </p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-tinta/70">
                  {fechas.map(fechaCorta).join(" · ")}
                </p>
                {/* Cada uno es independiente: quien lo crea tiene que saberlo
                    ANTES, porque después son cinco fichas que se editan una a
                    una y nadie espera eso de algo que pidió como "repetir". */}
                <p className="mt-2 text-xs font-semibold text-tinta/50">
                  Cada uno se crea por separado: podrás editarlos o borrarlos de uno en uno.
                </p>
              </>
            )}

            {tope && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-black text-oro-600">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Son más de {MAXIMO}. Se crearán los {MAXIMO} primeros; para el resto, repite
                el proceso desde la última fecha.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
