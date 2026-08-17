"use client";

import { useState } from "react";
import { FAMILIAS, valorGuardado } from "@/lib/musica";
import { ChevronDown, X } from "lucide-react";

/**
 * Selector de estilos musicales, compartido por el alta de DJ (/unirse), su
 * panel (/dj) y el alta desde administración.
 *
 * Va por familias y no con las 86 etiquetas de golpe: en un móvil, una lista
 * plana de 86 botones es medio kilómetro de scroll antes de llegar al botón de
 * guardar. Se abre una familia a la vez, pero se pueden elegir estilos de
 * varias: un DJ pincha remember y house sin que sea contradictorio.
 *
 * Guarda etiquetas legibles y no ids internos, porque esto mismo se enseña en
 * la ficha pública del DJ. Ver valorGuardado en lib/musica.
 */
export default function SelectorEstilos({
  valor,
  onChange,
}: {
  valor: string[];
  onChange: (estilos: string[]) => void;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  const alternar = (v: string) =>
    onChange(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v]);

  /** Cuántos estilos hay elegidos de una familia, para el contador del botón. */
  const cuantos = (familiaId: string) =>
    FAMILIAS.find((f) => f.id === familiaId)!
      .grupos.flatMap((g) => g.estilos.map((e) => valorGuardado(familiaId, e)))
      .filter((v) => valor.includes(v)).length;

  return (
    <div>
      {/* Lo elegido, siempre visible: con las familias plegadas, si no, no hay
          forma de saber qué llevas puesto. */}
      {valor.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {valor.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => alternar(v)}
              aria-label={`Quitar ${v}`}
              className="inline-flex items-center gap-1 rounded-full bg-magenta px-3 py-1.5 text-sm font-extrabold text-white"
            >
              {v} <X size={13} />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {FAMILIAS.map((fam) => {
          const n = cuantos(fam.id);
          const desplegada = abierta === fam.id;
          return (
            <div key={fam.id} className="rounded-2xl ring-1 ring-magenta-100">
              <button
                type="button"
                onClick={() => setAbierta(desplegada ? null : fam.id)}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-extrabold text-tinta/80"
              >
                <span>
                  {fam.nombre}
                  {n > 0 && <span className="ml-2 text-magenta">{n}</span>}
                </span>
                <ChevronDown size={18} className={`shrink-0 text-tinta/40 transition ${desplegada ? "rotate-180" : ""}`} />
              </button>

              {desplegada && (
                <div className="border-t border-magenta-100 p-3">
                  {fam.grupos.map((g, i) => (
                    <div key={g.nombre ?? i} className={i ? "mt-3" : ""}>
                      {/* Solo Electrónica tiene subgrupos. */}
                      {g.nombre && (
                        <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-tinta/45">{g.nombre}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {g.estilos.map((e) => {
                          const v = valorGuardado(fam.id, e);
                          const on = valor.includes(v);
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => alternar(v)}
                              className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-extrabold transition ${
                                on ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100 hover:ring-magenta"
                              }`}
                            >
                              {e}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
