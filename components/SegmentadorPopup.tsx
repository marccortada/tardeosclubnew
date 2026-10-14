"use client";

import { useState } from "react";
import { TIPOS_EVENTO, PUBLICOS, mismoValor } from "@/lib/adn";
import { FAMILIAS, idEstilo, etiquetaDe } from "@/lib/musica";
import { ZONAS } from "@/lib/zonas";
import { ChevronDown, Users } from "lucide-react";

export type Segmentacion = {
  musica: string[];
  tiposEvento: string[];
  edades: string[];
  zonas: string[];
};

export const SIN_SEGMENTAR: Segmentacion = { musica: [], tiposEvento: [], edades: [], zonas: [] };

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-[15px] font-semibold transition-colors ${
        activo ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta hover:border-tinta/50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A quién va la campaña, por gustos.
 *
 * Lo importante de esta pantalla es que se entienda que CADA criterio que se
 * añade reduce el público. Por eso se enseña el resumen en una frase mientras
 * se elige: sin él es facilísimo montar una campaña de "afro house + 55 años +
 * Terres de l'Ebre" y luego preguntarse por qué no la ve nadie.
 */
export default function SegmentadorPopup({
  valor,
  onCambio,
}: {
  valor: Segmentacion;
  onCambio: (s: Segmentacion) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [familiaAbierta, setFamiliaAbierta] = useState<string | null>(null);

  const alternar = (campo: keyof Segmentacion, v: string) => {
    const lista = valor[campo];
    onCambio({
      ...valor,
      [campo]: lista.some((x) => mismoValor(x, v)) ? lista.filter((x) => !mismoValor(x, v)) : [...lista, v],
    });
  };
  const puesto = (campo: keyof Segmentacion, v: string) => valor[campo].some((x) => mismoValor(x, v));

  const partes = [
    valor.musica.length ? `${valor.musica.map(etiquetaDe).join(", ")}` : null,
    valor.tiposEvento.length ? valor.tiposEvento.join(", ") : null,
    valor.edades.length ? valor.edades.join(" o ") : null,
    valor.zonas.length ? valor.zonas.join(", ") : null,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-linea bg-marfil p-3">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex min-h-[44px] w-full items-center gap-2 text-left text-[15px] font-semibold text-tinta"
      >
        <Users size={18} className="text-magenta" aria-hidden />
        <span className="flex-1">Acotar por gustos {partes.length > 0 && `(${partes.length})`}</span>
        <ChevronDown size={18} className={`transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {/* El resumen se ve SIEMPRE, abierto o cerrado: es la única defensa contra
          montar una campaña imposible sin darse cuenta. */}
      <p className="mt-1 text-sm text-tinta-suave">
        {partes.length === 0
          ? "Sin acotar: le sale a todo el mundo que cumpla lo de arriba."
          : `Solo a quien cumpla TODO: ${partes.join(" · ")}. Quien no haya dicho sus gustos no lo verá.`}
      </p>

      {abierto && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-tinta-suave">Música</p>
            <div className="flex flex-wrap gap-2">
              {FAMILIAS.map((fam) => (
                <Chip key={fam.id} activo={puesto("musica", fam.id)} onClick={() => alternar("musica", fam.id)}>
                  {fam.nombre}
                </Chip>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFamiliaAbierta((a) => (a ? null : FAMILIAS[0].id))}
              className="mt-1 min-h-[44px] text-sm font-semibold text-magenta-700 underline"
            >
              {familiaAbierta ? "Ocultar estilos concretos" : "Afinar por estilo concreto"}
            </button>
            {/* Pedir la familia ya alcanza a quien marcó un estilo suyo, así que
                bajar al estilo solo tiene sentido para campañas muy finas. */}
            {familiaAbierta && (
              <div className="mt-2 flex flex-col gap-2 rounded-xl border border-linea bg-white p-3">
                <div className="flex flex-wrap gap-1.5">
                  {FAMILIAS.map((f) => (
                    <button key={f.id} type="button" onClick={() => setFamiliaAbierta(f.id)} aria-pressed={familiaAbierta === f.id}
                      className={`min-h-[40px] rounded-full px-3 text-sm font-semibold ${familiaAbierta === f.id ? "bg-magenta-50 text-magenta-700" : "bg-marfil-100 text-tinta-suave"}`}>
                      {f.nombre}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {FAMILIAS.find((f) => f.id === familiaAbierta)!.grupos.flatMap((g) => g.estilos).map((e) => {
                    const id = idEstilo(familiaAbierta, e);
                    return <Chip key={id} activo={puesto("musica", id)} onClick={() => alternar("musica", id)}>{e}</Chip>;
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-tinta-suave">Tipo de plan</p>
            <div className="flex flex-wrap gap-2">
              {TIPOS_EVENTO.map((v) => (
                <Chip key={v} activo={puesto("tiposEvento", v)} onClick={() => alternar("tiposEvento", v)}>{v}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-tinta-suave">Edad</p>
            <div className="flex flex-wrap gap-2">
              {PUBLICOS.map((v) => (
                <Chip key={v} activo={puesto("edades", v)} onClick={() => alternar("edades", v)}>{v}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-tinta-suave">Zona</p>
            <div className="flex flex-wrap gap-2">
              {ZONAS.map((z) => (
                <Chip key={z} activo={puesto("zonas", z)} onClick={() => alternar("zonas", z)}>{z}</Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
