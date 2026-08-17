"use client";

import { useState } from "react";
import { AMBIENTES, TIPOS_EVENTO, PUBLICOS, DRESS_CODES, mismoValor } from "@/lib/adn";
import { Users, Shirt, X, Sparkles, PartyPopper } from "lucide-react";

/**
 * Tipo de evento, ambiente, público (edad) y outfit de un tardeo: el "ADN" con
 * el que después se cruzarán tardeo, local, DJ y tardícola para recomendar.
 *
 * Los cuatro llevan "Otro…" de escritura libre a propósito: las listas son
 * sugerencias. Un local que hace una fiesta de disfraces necesita poder
 * escribirlo, y si le forzamos a elegir "Libre" perdemos el dato.
 *
 * Ambiente y público admiten varios —un afterwork es también social, y un
 * tardeo puede ir de 25 a 55, que son dos tramos—; el tipo y el outfit solo
 * uno, porque una fiesta no es un brunch y un nocheo a la vez, ni "Casual" y
 * "Dressed to impress" al mismo tiempo.
 */
export default function SelectorAdn({
  tipoEvento,
  ambiente,
  publico,
  dressCode,
  onTipoEvento,
  onAmbiente,
  onPublico,
  onDressCode,
}: {
  tipoEvento: string;
  ambiente: string[];
  publico: string[];
  dressCode: string;
  onTipoEvento: (v: string) => void;
  onAmbiente: (v: string[]) => void;
  onPublico: (v: string[]) => void;
  onDressCode: (v: string) => void;
}) {
  const [otroTipo, setOtroTipo] = useState("");
  const [otroAmbiente, setOtroAmbiente] = useState("");
  const [otroPublico, setOtroPublico] = useState("");
  const [otroOutfit, setOtroOutfit] = useState("");

  const anadirOtroTipo = () => {
    const v = otroTipo.trim();
    if (v) onTipoEvento(v);
    setOtroTipo("");
  };

  const alternarAmbiente = (v: string) =>
    onAmbiente(ambiente.some((a) => mismoValor(a, v)) ? ambiente.filter((a) => !mismoValor(a, v)) : [...ambiente, v]);

  const anadirOtroAmbiente = () => {
    const v = otroAmbiente.trim();
    if (v && !ambiente.some((a) => mismoValor(a, v))) onAmbiente([...ambiente, v]);
    setOtroAmbiente("");
  };

  const alternarPublico = (v: string) =>
    onPublico(publico.some((p) => mismoValor(p, v)) ? publico.filter((p) => !mismoValor(p, v)) : [...publico, v]);

  const anadirOtroPublico = () => {
    const v = otroPublico.trim();
    // Sin duplicar: si escribe "25-35" a mano, ya está en la lista de arriba.
    if (v && !publico.some((p) => mismoValor(p, v))) onPublico([...publico, v]);
    setOtroPublico("");
  };

  const anadirOtroOutfit = () => {
    const v = otroOutfit.trim();
    if (v) onDressCode(v);
    setOtroOutfit("");
  };

  /** Lo escrito a mano, que no está entre las sugerencias. */
  const tipoLibre = tipoEvento && !TIPOS_EVENTO.some((s) => mismoValor(s, tipoEvento)) ? tipoEvento : "";
  const ambienteLibre = ambiente.filter((a) => !AMBIENTES.some((s) => mismoValor(s, a)));
  const publicoLibre = publico.filter((p) => !PUBLICOS.some((s) => mismoValor(s, p)));
  const outfitLibre = dressCode && !DRESS_CODES.some((s) => mismoValor(s, dressCode)) ? dressCode : "";

  const chip = (activo: boolean) =>
    `min-h-[44px] rounded-full px-4 py-2 text-sm font-extrabold transition ${
      activo ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100 hover:ring-magenta"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
          <PartyPopper size={15} className="text-magenta" /> Tipo de evento
        </label>
        <div className="flex flex-wrap gap-2">
          {TIPOS_EVENTO.map((v) => (
            <button key={v} type="button"
              onClick={() => onTipoEvento(mismoValor(tipoEvento, v) ? "" : v)}
              className={chip(mismoValor(tipoEvento, v))}>
              {v}
            </button>
          ))}
          {tipoLibre && (
            <button type="button" onClick={() => onTipoEvento("")}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-magenta px-4 py-2 text-sm font-extrabold text-white">
              {tipoLibre} <X size={13} />
            </button>
          )}
        </div>
        <input
          value={otroTipo}
          onChange={(e) => setOtroTipo(e.target.value)}
          onBlur={anadirOtroTipo}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); anadirOtroTipo(); } }}
          placeholder="Otro…"
          className="mt-2 w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
        />
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
          <Sparkles size={15} className="text-magenta" /> Ambiente
        </label>
        <div className="flex flex-wrap gap-2">
          {AMBIENTES.map((v) => (
            <button key={v} type="button" onClick={() => alternarAmbiente(v)}
              className={chip(ambiente.some((a) => mismoValor(a, v)))}>
              {v}
            </button>
          ))}
          {ambienteLibre.map((v) => (
            <button key={v} type="button" onClick={() => alternarAmbiente(v)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-magenta px-4 py-2 text-sm font-extrabold text-white">
              {v} <X size={13} />
            </button>
          ))}
        </div>
        <input
          value={otroAmbiente}
          onChange={(e) => setOtroAmbiente(e.target.value)}
          onBlur={anadirOtroAmbiente}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); anadirOtroAmbiente(); } }}
          placeholder="Otro…"
          className="mt-2 w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
        />
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
          <Users size={15} className="text-magenta" /> Público
        </label>
        <div className="flex flex-wrap gap-2">
          {PUBLICOS.map((v) => (
            <button key={v} type="button" onClick={() => alternarPublico(v)}
              className={chip(publico.some((p) => mismoValor(p, v)))}>
              {v}
            </button>
          ))}
          {publicoLibre.map((v) => (
            <button key={v} type="button" onClick={() => alternarPublico(v)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-magenta px-4 py-2 text-sm font-extrabold text-white">
              {v} <X size={13} />
            </button>
          ))}
        </div>
        <input
          value={otroPublico}
          onChange={(e) => setOtroPublico(e.target.value)}
          onBlur={anadirOtroPublico}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); anadirOtroPublico(); } }}
          placeholder="Otro…"
          className="mt-2 w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
        />
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
          <Shirt size={15} className="text-magenta" /> Outfit / Dress code
        </label>
        <div className="flex flex-wrap gap-2">
          {DRESS_CODES.map((v) => (
            <button key={v} type="button"
              onClick={() => onDressCode(mismoValor(dressCode, v) ? "" : v)}
              className={chip(mismoValor(dressCode, v))}>
              {v}
            </button>
          ))}
          {outfitLibre && (
            <button type="button" onClick={() => onDressCode("")}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-magenta px-4 py-2 text-sm font-extrabold text-white">
              {outfitLibre} <X size={13} />
            </button>
          )}
        </div>
        <input
          value={otroOutfit}
          onChange={(e) => setOtroOutfit(e.target.value)}
          onBlur={anadirOtroOutfit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); anadirOtroOutfit(); } }}
          placeholder="Otro…"
          className="mt-2 w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
        />
      </div>
    </div>
  );
}
