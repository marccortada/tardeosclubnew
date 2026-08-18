"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Check } from "lucide-react";

export type Direccion = {
  display: string;
  lat: number;
  lng: number;
  cp: string;
  zona: string;
};

/**
 * Busca una dirección o un sitio por su nombre.
 *
 * Usa Nominatim (OpenStreetMap), que además de calles tiene negocios fichados:
 * escribir "Miracle Mataró" encuentra el local, no solo la calle. Tiene menos
 * bares que Google Maps, así que cuando no aparezca hay que buscar por la calle
 * — de ahí que el texto de ayuda mencione las dos formas.
 */
export default function AddressSearch({
  onSelect,
  inicial = "",
  placeholder = "Busca el sitio por su nombre o por la calle…",
}: {
  onSelect: (d: Direccion) => void;
  /** Texto de arranque: el nombre del local, para que salga su ficha sin
   *  que tenga que escribirlo. */
  inicial?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState(inicial);
  const [res, setRes] = useState<Direccion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Direccion | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 3 || sel) { setRes([]); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=es&q=${encodeURIComponent(q)}`,
          { headers: { "Accept-Language": "es" } }
        );
        const j = await r.json();
        setRes(
          (j ?? []).map((x: any) => ({
            display: x.display_name,
            lat: +x.lat,
            lng: +x.lon,
            cp: x.address?.postcode ?? "",
            zona:
              x.address?.city || x.address?.town || x.address?.village ||
              x.address?.municipality || x.address?.county || x.address?.state || "",
          }))
        );
        setOpen(true);
      } catch {
        /* silencio */
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(id);
  }, [q, sel]);

  const elegir = (d: Direccion) => {
    setSel(d);
    setQ(d.display);
    setOpen(false);
    onSelect(d);
  };

  if (sel) {
    return (
      <div className="rounded-xl border-2 border-oro/50 bg-oro/5 p-3">
        <div className="flex items-start gap-2">
          <Check size={18} className="mt-0.5 shrink-0 text-oro-600" />
          <div className="min-w-0 text-sm">
            <p className="font-bold text-tinta">{sel.display}</p>
            <p className="mt-0.5 font-semibold text-tinta/60">
              {sel.cp && `CP ${sel.cp} · `}Zona: <b>{sel.zona || "—"}</b>
            </p>
          </div>
        </div>
        <button
          onClick={() => { setSel(null); setQ(""); }}
          className="mt-2 text-sm font-bold text-magenta"
        >
          Cambiar dirección
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <div className="flex items-center gap-2 rounded-xl border-2 border-magenta-100 bg-white px-3 focus-within:border-magenta">
        <MapPin size={18} className="text-magenta" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-3 text-base font-semibold outline-none"
        />
        {loading && <Loader2 size={18} className="animate-spin text-magenta" />}
      </div>
      {/* Sin resultados hay que decirlo Y decir qué hacer. OpenStreetMap tiene
          las calles completas pero pocos bares fichados —de cuatro locales
          reales solo encuentra uno por su nombre—, así que quedarse en blanco
          hace pensar que el buscador está roto cuando lo que pasa es que ese
          sitio no está en el mapa con ese nombre. */}
      {open && !loading && q.trim().length >= 3 && res.length === 0 && !sel && (
        <p className="mt-1.5 rounded-xl bg-magenta-50 p-3 text-xs font-semibold text-tinta/70">
          No encontramos ese sitio por el nombre. Prueba con la calle y el número.
        </p>
      )}

      {open && res.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-black/10 bg-white shadow-tarjeta">
          {res.map((d, i) => (
            <li key={i}>
              <button
                onClick={() => elegir(d)}
                className="flex w-full items-start gap-2 border-b border-black/5 p-3 text-left text-sm font-semibold text-tinta/80 hover:bg-magenta-50"
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-magenta" />
                <span>{d.display}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
