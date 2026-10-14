"use client";

import { Ticket, Link2, AlertTriangle } from "lucide-react";

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

/**
 * ¿Se puede guardar este enlace? Devuelve el motivo si no, o null si vale.
 *
 * Se exige https: el botón de entradas abre una pasarela de pago, y un enlace
 * sin cifrar (o un "fourvenues.com/…" sin protocolo, que el navegador tomaría
 * por una ruta de nuestra propia web) acaba en un 404 o en algo peor.
 */
export function errorEnlace(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/\s/.test(u)) return "El enlace no puede llevar espacios.";
  if (!/^https:\/\//i.test(u)) return "Tiene que empezar por https:// (cópialo entero desde el navegador).";
  try { new URL(u); } catch { return "Ese enlace no se entiende. Cópialo otra vez entero."; }
  return null;
}

/** Primer problema de la entrada que impide guardar, o null. */
export function errorPrecio(p: Precio): string | null {
  if (p.modo === "conprecio" && !(Number(p.importe) > 0)) return "Indica el precio de la entrada, o elige «Sin precio».";
  const e = errorEnlace(p.urlEntradas);
  if (e) return `Enlace de entradas: ${e}`;
  const f = errorEnlace(p.urlPromos);
  if (f) return `Enlace de promociones: ${f}`;
  return null;
}

const claseInput = (mal: boolean) =>
  `w-full min-h-tacto rounded-xl border bg-white px-4 py-3 text-base font-medium outline-none transition focus:ring-4 ${
    mal ? "border-error focus:ring-error/15" : "border-linea-fuerte focus:border-magenta focus:ring-magenta/15"}`;

export default function PrecioTardeo({ valor, onCambio }: { valor: Precio; onCambio: (p: Precio) => void }) {
  const errEntradas = errorEnlace(valor.urlEntradas);
  const errPromos = errorEnlace(valor.urlPromos);
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
        <Ticket size={18} className="text-magenta" aria-hidden /> Precio de la entrada
      </p>

      <div className="grid grid-cols-2 gap-2">
        {OPCIONES.map((o) => (
          <button
            key={o.k}
            type="button"
            aria-pressed={valor.modo === o.k}
            onClick={() => onCambio({ ...valor, modo: o.k })}
            className={`min-h-[64px] rounded-xl border px-3 py-2.5 text-left transition ${
              valor.modo === o.k ? "border-magenta bg-magenta-50 ring-1 ring-magenta" : "border-linea-fuerte bg-white hover:border-tinta/40"
            }`}
          >
            <span className={`block text-[15px] font-bold ${valor.modo === o.k ? "text-magenta-700" : "text-tinta"}`}>
              {o.label}
            </span>
            <span className="block text-[13px] text-tinta-suave">{o.pie}</span>
          </button>
        ))}
      </div>

      {/* El importe solo cuando toca: pedirlo siempre invita a rellenarlo en un
          tardeo gratis y acabar publicando "Gratis · 12 €". */}
      {valor.modo === "conprecio" && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[15px] font-semibold">Precio (€)</span>
          <input
            type="number" min="0" max="500" step="0.5" inputMode="decimal"
            value={valor.importe}
            onChange={(e) => onCambio({ ...valor, importe: e.target.value })}
            placeholder="Ej: 12"
            className={claseInput(false)}
          />
          {/*
            Aviso, no bloqueo. Hay 163 tardeos con precio en la cartelera: la
            mediana son 10 € y solo tres pasan de 100. Ahora mismo hay uno
            publicado y en portada a 10.000 €, que es un dedo de más y nadie lo
            vio hasta que rompió la tarjeta.

            No se impide guardarlo —un festival caro existe— pero se dice, que
            es lo que hace falta para que quien lo escribió lo mire otra vez.
          */}
          {Number(valor.importe) > 100 && (
            <span className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-aviso">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
              {Number(valor.importe)} € es mucho para un tardeo. Compruébalo antes de publicar.
            </span>
          )}
        </label>
      )}

      {/* El enlace que da dinero. Se llama `fourvenues_url` en la base por la
          app antigua, pero vale el de cualquier ticketera o lista. */}
      <label className="mt-4 block">
        <span className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold">
          <Link2 size={16} className="text-magenta" aria-hidden /> Enlace de entradas o lista (Fourvenues u otra)
        </span>
        <input
          type="url"
          inputMode="url"
          value={valor.urlEntradas}
          onChange={(e) => onCambio({ ...valor, urlEntradas: e.target.value })}
          placeholder="https://web.fourvenues.com/…"
          aria-invalid={!!errEntradas}
          className={claseInput(!!errEntradas)}
        />
        <span className={`mt-1.5 block text-sm ${errEntradas ? "font-semibold text-error" : "text-tinta-suave"}`}>
          {errEntradas ?? "Opcional. Si lo pones, el botón del tardeo lleva a esta página para comprar o apuntarse a la lista, en vez de apuntarse aquí. Cópialo entero desde el navegador."}
        </span>
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold">
          <Link2 size={16} className="text-magenta" aria-hidden /> Enlace de promociones o reservas (opcional)
        </span>
        <input
          type="url"
          inputMode="url"
          value={valor.urlPromos}
          onChange={(e) => onCambio({ ...valor, urlPromos: e.target.value })}
          placeholder="https://…"
          aria-invalid={!!errPromos}
          className={claseInput(!!errPromos)}
        />
        {errPromos && <span className="mt-1.5 block text-sm font-semibold text-error">{errPromos}</span>}
      </label>
    </div>
  );
}
