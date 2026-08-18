"use client";

import { useMemo, useState } from "react";
import { Search, X, Store, Megaphone, Check } from "lucide-react";

type Local = { id: string; nombre: string; zona?: string | null; tipo?: string | null };

/** Sin acentos ni mayúsculas: buscar "cafe" tiene que encontrar "Café". */
const norma = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Elegir en qué local se publica.
 *
 * Con un solo local no hay nada que elegir y se enseña a secas: es el caso del
 * dueño de un bar, y ponerle un buscador de una fila sería ruido.
 *
 * Con muchos —el admin ve los 61— un desplegable nativo obliga a buscar a
 * scroll, y en el móvil es una rueda interminable. Por eso hay lupa: se escribe
 * y se filtra por nombre o por zona.
 */
export default function SelectorLocal({
  locales,
  valor,
  onCambio,
}: {
  locales: Local[];
  valor: string;
  onCambio: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const elegido = locales.find((l) => l.id === valor) ?? null;

  const filtrados = useMemo(() => {
    const s = norma(q.trim());
    if (!s) return locales;
    return locales.filter((l) => norma(l.nombre).includes(s) || norma(l.zona ?? "").includes(s));
  }, [locales, q]);

  // Un solo local: no hay elección posible.
  if (locales.length === 1) {
    const l = locales[0];
    return (
      <p className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-extrabold ring-1 ring-magenta-100">
        {l.tipo === "promotor" ? <Megaphone size={17} className="text-magenta" /> : <Store size={17} className="text-magenta" />}
        {l.nombre}
        {l.zona && <span className="font-semibold text-tinta/50">· {l.zona}</span>}
      </p>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta/40" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Buscar entre ${locales.length} locales…`}
          className="w-full rounded-xl border-2 border-magenta-100 bg-white py-3 pl-11 pr-10 font-semibold outline-none focus:border-magenta"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Borrar búsqueda"
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-tinta/40 hover:bg-black/5"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* El elegido se ve siempre, aunque la búsqueda lo deje fuera de la lista:
          si no, escribir cualquier cosa daba la sensación de haberlo perdido. */}
      {elegido && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-extrabold text-magenta">
          <Check size={15} /> {elegido.nombre}
          {elegido.zona && <span className="font-semibold text-tinta/50">· {elegido.zona}</span>}
        </p>
      )}

      <div className="mt-2 max-h-56 overflow-y-auto rounded-xl ring-1 ring-magenta-100">
        {filtrados.length === 0 ? (
          <p className="p-4 text-center text-sm font-bold text-tinta/50">Ningún local con ese nombre.</p>
        ) : (
          filtrados.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onCambio(l.id)}
              className={`flex w-full items-center gap-2 border-b border-magenta-50 px-4 py-3 text-left text-sm font-extrabold transition last:border-0 ${
                l.id === valor ? "bg-magenta text-white" : "bg-white text-tinta/80 hover:bg-magenta-50"
              }`}
            >
              {l.tipo === "promotor"
                ? <Megaphone size={15} className={l.id === valor ? "" : "text-magenta"} />
                : <Store size={15} className={l.id === valor ? "" : "text-magenta"} />}
              <span className="flex-1">{l.nombre}</span>
              {l.zona && (
                <span className={`text-xs font-semibold ${l.id === valor ? "text-white/70" : "text-tinta/45"}`}>
                  {l.zona}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
