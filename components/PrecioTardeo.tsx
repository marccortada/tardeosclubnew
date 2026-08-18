"use client";

import { Ticket, Link2 } from "lucide-react";

/**
 * Cómo se cobra la entrada.
 *
 * Cuatro opciones y no tres. La que faltaba es "Sin precio": de pago, pero sin
 * importe publicado. Es el caso más común de la cartelera real —361 de 662— y
 * sin ella el local tenía que mentir: o marcarlo gratis, que engaña a quien
 * llega sin dinero, o inventarse una cifra.
 */
export type Precio = {
  modo: "conprecio" | "gratis" | "sinprecio" | "lista";
  importe: string;
  /** Venta externa: si está, el botón "Apúntame" lleva ahí. */
  urlEntradas: string;
  urlPromos: string;
};

export const PRECIO_VACIO: Precio = { modo: "gratis", importe: "", urlEntradas: "", urlPromos: "" };

const OPCIONES = [
  { k: "conprecio", label: "Con precio", pie: "Se muestra el importe" },
  { k: "gratis", label: "Gratis", pie: "Se publica como «Gratis»" },
  { k: "sinprecio", label: "Sin precio", pie: "De pago, sin importe" },
  { k: "lista", label: "Por lista", pie: "Se publica como «Por lista»" },
] as const;

/** Traduce a las tres columnas de la base, que no cambian. */
export function aColumnas(p: Precio) {
  return {
    es_de_pago: p.modo === "conprecio" || p.modo === "sinprecio",
    tiene_lista: p.modo === "lista",
    precio: p.modo === "conprecio" ? Number(p.importe) || null : null,
    fourvenues_url: p.urlEntradas.trim() || null,
    promo_url: p.urlPromos.trim() || null,
  };
}

/** Y de vuelta, para el formulario de editar. */
export function desdeColumnas(t: {
  tipoEntrada?: string; precio?: number; fourvenues_url?: string | null; promo_url?: string | null;
}): Precio {
  const modo: Precio["modo"] =
    t.tipoEntrada === "lista" ? "lista"
      : t.tipoEntrada === "pago" ? (t.precio != null ? "conprecio" : "sinprecio")
      : "gratis";
  return {
    modo,
    importe: t.precio != null ? String(t.precio) : "",
    urlEntradas: t.fourvenues_url ?? "",
    urlPromos: t.promo_url ?? "",
  };
}

export default function PrecioTardeo({ valor, onCambio }: { valor: Precio; onCambio: (p: Precio) => void }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
        <Ticket size={15} className="text-magenta" /> Precio del evento
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {OPCIONES.map((o) => (
          <button
            key={o.k}
            type="button"
            onClick={() => onCambio({ ...valor, modo: o.k })}
            className={`rounded-xl px-4 py-3 text-left transition ${
              valor.modo === o.k ? "bg-magenta-50 ring-2 ring-magenta" : "bg-white ring-1 ring-magenta-100 hover:ring-magenta"
            }`}
          >
            <span className={`block text-sm font-extrabold ${valor.modo === o.k ? "text-magenta-700" : "text-tinta/80"}`}>
              {o.label}
            </span>
            <span className="block text-xs font-semibold text-tinta/50">{o.pie}</span>
          </button>
        ))}
      </div>

      {/* El importe solo cuando toca: pedirlo siempre invita a rellenarlo en un
          tardeo gratis y acabar publicando "Gratis · 12 €". */}
      {valor.modo === "conprecio" && (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-black text-tinta/70">Precio (€) *</span>
          <input
            type="number" min="0" step="0.5" inputMode="decimal"
            value={valor.importe}
            onChange={(e) => onCambio({ ...valor, importe: e.target.value })}
            placeholder="Ej: 12"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
          />
        </label>
      )}

      <label className="mt-3 block">
        <span className="mb-1 flex items-center gap-1.5 text-sm font-black text-tinta/70">
          <Link2 size={14} className="text-magenta" /> Link de entradas
        </span>
        <input
          type="url"
          value={valor.urlEntradas}
          onChange={(e) => onCambio({ ...valor, urlEntradas: e.target.value })}
          placeholder="https://entradas.ejemplo.com"
          className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
        />
        <span className="mt-1 block text-xs font-semibold text-tinta/50">
          Si lo rellenas, el botón «Apúntame» abrirá este enlace en vez de apuntarse aquí.
        </span>
      </label>

      <label className="mt-3 block">
        <span className="mb-1 flex items-center gap-1.5 text-sm font-black text-tinta/70">
          <Link2 size={14} className="text-magenta" /> Link de promociones
        </span>
        <input
          type="url"
          value={valor.urlPromos}
          onChange={(e) => onCambio({ ...valor, urlPromos: e.target.value })}
          placeholder="https://promos.ejemplo.com"
          className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
        />
      </label>
    </div>
  );
}
