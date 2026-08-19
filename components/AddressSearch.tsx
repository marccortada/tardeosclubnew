"use client";

import { useRef, useState } from "react";
import { MapPin, Loader2, Check, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
 * Pregunta a `/api/buscar-sitio`, que por detrás usa Google Places —el mismo
 * buscador de Google Maps, así que un bar sale escribiendo su nombre— y cae a
 * OpenStreetMap si Google no está disponible. La clave de Google no baja al
 * navegador: vive en el servidor.
 *
 * Busca al pulsar Buscar o Enter, NO mientras escribes. Google cobra por
 * petición: buscar según teclea son veinte llamadas para encontrar un local,
 * y una sola hace el mismo trabajo.
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
  const [buscado, setBuscado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<Direccion | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const buscar = async () => {
    const texto = q.trim();
    if (texto.length < 3 || loading) return;
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/buscar-sitio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: texto, accessToken: session?.access_token }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No se pudo buscar.");
      setRes(j.resultados ?? []);
      setBuscado(texto);
    } catch (e: any) {
      setRes([]);
      setBuscado(texto);
      setError(e?.message || "No se pudo buscar.");
    } finally {
      setLoading(false);
    }
  };

  const elegir = (d: Direccion) => {
    setSel(d);
    setQ(d.display);
    setRes([]);
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
          onClick={() => { setSel(null); setQ(""); setRes([]); setBuscado(""); setError(""); }}
          className="mt-2 text-sm font-bold text-magenta"
        >
          Cambiar dirección
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <div className="flex items-center gap-2 rounded-xl border-2 border-magenta-100 bg-white pl-3 focus-within:border-magenta">
        <MapPin size={18} className="shrink-0 text-magenta" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }}
          placeholder={placeholder}
          className="w-full bg-transparent py-3 text-base font-semibold outline-none"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={q.trim().length < 3 || loading}
          className="my-1.5 mr-1.5 flex shrink-0 items-center gap-1.5 rounded-lg bg-magenta px-3 py-2 text-sm font-extrabold text-white transition hover:brightness-105 disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </div>

      {error && (
        <p className="mt-1.5 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>
      )}

      {/* Sin resultados hay que decirlo Y decir qué hacer, para que no parezca
          que el buscador está roto cuando lo que pasa es que ese sitio no está
          fichado con ese nombre. */}
      {!loading && !error && buscado && res.length === 0 && (
        <p className="mt-1.5 rounded-xl bg-magenta-50 p-3 text-xs font-semibold text-tinta/70">
          No encontramos «{buscado}». Prueba con la calle y el número, o añade la ciudad.
        </p>
      )}

      {res.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-black/10 bg-white shadow-tarjeta">
          {res.map((d, i) => (
            <li key={i}>
              <button
                type="button"
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
