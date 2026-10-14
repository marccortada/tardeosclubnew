"use client";

import { Tag, X, Plus } from "lucide-react";

export type Promo = { etiquetas: string[] };
export const PROMO_VACIA: Promo = { etiquetas: [] };

/** Las que pide todo el mundo. Son atajos: la lista no está cerrada. */
const SUGERIDAS = [
  "2x1", "Chicas gratis", "Entrada con consumición", "Lista hasta las 20h",
  "Descuento con RRPP", "Cumpleaños gratis",
];

/**
 * Los rótulos cortos de un tardeo: "2x1", "Chicas gratis", "Lista hasta las 20h".
 *
 * NO son promociones, y la diferencia importa. Una promoción (lote 32) tiene
 * código, fechas, límite de usos y a quién va dirigida, y se enciende y se
 * apaga sola. Esto es una etiqueta que se pinta en la tarjeta para que se vea
 * de un vistazo por qué merece la pena ese tardeo.
 *
 * Antes esto llevaba además un título y un texto de promoción. Se han ido a la
 * entidad propia, que es lo que pedía el punto 15: allí una promoción se puede
 * enseñar en la tarjeta, en la ficha o en un pop-up sin copiarla tres veces.
 */
export default function PromoTardeo({ valor, onCambio }: { valor: Promo; onCambio: (p: Promo) => void }) {
  const alternar = (e: string) =>
    onCambio({
      ...valor,
      etiquetas: valor.etiquetas.includes(e)
        ? valor.etiquetas.filter((x) => x !== e)
        : [...valor.etiquetas, e],
    });

  const anadirLibre = (texto: string) => {
    const v = texto.trim();
    if (v && !valor.etiquetas.includes(v)) onCambio({ ...valor, etiquetas: [...valor.etiquetas, v] });
  };

  return (
    <div className="rounded-2xl border border-linea bg-white p-4">
      <p className="flex items-center gap-1.5 text-[15px] font-semibold text-tinta">
        <Tag size={15} className="text-magenta" /> Etiquetas
      </p>
      <p className="mt-0.5 text-sm text-tinta-suave">
        Rótulos cortos que se ven en la tarjeta. Para ofertas con código y fechas,
        usa las promociones de abajo.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {[...new Set([...SUGERIDAS, ...valor.etiquetas])].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => alternar(e)}
            className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-4 py-2 text-[15px] font-semibold transition ${
              valor.etiquetas.includes(e) ? "bg-tinta text-white" : "bg-white text-tinta-suave ring-1 ring-linea-fuerte"
            }`}
          >
            {e} {valor.etiquetas.includes(e) && <X size={12} />}
          </button>
        ))}
      </div>
      <input
        placeholder="Otra etiqueta…"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          anadirLibre((e.target as HTMLInputElement).value);
          (e.target as HTMLInputElement).value = "";
        }}
        onBlur={(e) => { anadirLibre(e.target.value); e.target.value = ""; }}
        className="mt-2 w-full rounded-xl border border-linea-fuerte bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-magenta"
      />
    </div>
  );
}
