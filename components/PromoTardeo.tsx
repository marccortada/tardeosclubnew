"use client";

import { Tag, X, Plus } from "lucide-react";

export type Promo = { titulo: string; texto: string; etiquetas: string[] };
export const PROMO_VACIA: Promo = { titulo: "", texto: "", etiquetas: [] };

/** Las que pide todo el mundo. Son atajos: la lista no está cerrada. */
const SUGERIDAS = [
  "2x1", "Chicas gratis", "Entrada con consumición", "Lista hasta las 20h",
  "Descuento con RRPP", "Cumpleaños gratis",
];

/**
 * La promoción de un tardeo, tal como la pone su local.
 *
 * Ojo con lo que NO es: esto no salta en la portada ni le aparece a quien pasa
 * por la app. Se ve dentro de la ficha del tardeo, o sea, a quien ya ha entrado
 * a mirarlo. Un local puede promocionar lo suyo sin interrumpir a nadie.
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
    <div className="rounded-2xl bg-oro/10 p-4">
      <p className="flex items-center gap-1.5 text-sm font-black text-tinta/80">
        <Tag size={15} className="text-oro-600" /> Promoción de este tardeo
      </p>
      <p className="mt-0.5 text-xs font-semibold text-tinta/55">
        Se ve dentro de tu tardeo, a quien entre a mirarlo. No sale en la portada.
      </p>

      <input
        value={valor.titulo}
        onChange={(e) => onCambio({ ...valor, titulo: e.target.value })}
        placeholder="Ej: 2x1 en cócteles hasta las 21 h"
        className="mt-3 w-full rounded-xl border-2 border-oro/40 bg-white px-4 py-3 font-semibold outline-none focus:border-oro"
      />
      <textarea
        value={valor.texto}
        onChange={(e) => onCambio({ ...valor, texto: e.target.value })}
        rows={2}
        placeholder="Detalles: cómo se consigue, hasta cuándo…"
        className="mt-2 w-full rounded-xl border-2 border-oro/40 bg-white px-4 py-3 font-semibold outline-none focus:border-oro"
      />

      <p className="mb-1.5 mt-3 text-xs font-black uppercase tracking-wide text-tinta/45">Etiquetas</p>
      <div className="flex flex-wrap gap-2">
        {[...new Set([...SUGERIDAS, ...valor.etiquetas])].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => alternar(e)}
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1.5 text-sm font-extrabold transition ${
              valor.etiquetas.includes(e) ? "bg-oro text-tinta" : "bg-white text-tinta/70 ring-1 ring-oro/40"
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
        className="mt-2 w-full rounded-xl border-2 border-oro/40 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-oro"
      />
    </div>
  );
}
