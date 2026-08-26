"use client";

import { useState } from "react";
import SelectorEstilos from "@/components/SelectorEstilos";
import { AMBIENTES, PUBLICOS, DRESS_CODES, TIPOS_LOCAL, ESPACIOS, tamanoDeAforo, mismoValor } from "@/lib/adn";
import { Users, Shirt, Sparkles, Store, Music, LayoutGrid, Clock } from "lucide-react";

export type AdnLocal = {
  tipoLocal: string;
  aforo: string;          // texto: el input es de texto y se convierte al guardar
  espacios: string[];
  musica: string[];
  ambiente: string[];
  publico: string[];
  dressCode: string;
  horarioHabitual: string;
};

export const ADN_LOCAL_VACIO: AdnLocal = {
  tipoLocal: "", aforo: "", espacios: [], musica: [],
  ambiente: [], publico: [], dressCode: "", horarioHabitual: "",
};

/**
 * Cómo es el sitio, no qué pasa en él esta tarde.
 *
 * Usa el MISMO vocabulario que el ADN del tardeo y el del tardícola: si cada
 * uno tuviera el suyo no se podrían cruzar, que es para lo que existe esto.
 *
 * Nada es obligatorio. Un local que rellena tres cosas ya sale en más búsquedas
 * que uno que no rellena ninguna, y exigirlo todo es la forma segura de que no
 * se rellene nada.
 */
export default function SelectorAdnLocal({
  adn,
  onCambio,
}: {
  adn: AdnLocal;
  onCambio: (a: AdnLocal) => void;
}) {
  const [otroTipo, setOtroTipo] = useState("");
  const set = <K extends keyof AdnLocal>(k: K, v: AdnLocal[K]) => onCambio({ ...adn, [k]: v });

  const alternar = (k: "espacios" | "ambiente" | "publico", v: string) => {
    const lista = adn[k];
    set(k, lista.some((x) => mismoValor(x, v)) ? lista.filter((x) => !mismoValor(x, v)) : [...lista, v]);
  };

  const chip = (activo: boolean) =>
    `min-h-[44px] rounded-full px-4 py-2 text-sm font-extrabold transition ${
      activo ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100 hover:ring-magenta"
    }`;

  const Bloque = ({ icono: Icono, titulo, pista, children }: {
    icono: typeof Store; titulo: string; pista?: string; children: React.ReactNode;
  }) => (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
        <Icono size={15} className="text-magenta" /> {titulo}
      </label>
      {pista && <p className="mb-1.5 text-xs font-semibold text-tinta/50">{pista}</p>}
      {children}
    </div>
  );

  // Lo escrito a mano que no está entre las sugerencias.
  const tipoLibre = adn.tipoLocal && !TIPOS_LOCAL.some((s) => mismoValor(s, adn.tipoLocal)) ? adn.tipoLocal : "";
  const tamano = tamanoDeAforo(Number(adn.aforo));

  return (
    <div className="flex flex-col gap-5">
      <Bloque icono={Store} titulo="Qué clase de sitio es">
        <div className="flex flex-wrap gap-2">
          {TIPOS_LOCAL.map((v) => (
            <button key={v} type="button" onClick={() => set("tipoLocal", mismoValor(adn.tipoLocal, v) ? "" : v)}
              className={chip(mismoValor(adn.tipoLocal, v))}>{v}</button>
          ))}
          {tipoLibre && (
            <button type="button" onClick={() => set("tipoLocal", "")} className={chip(true)}>{tipoLibre} ✕</button>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={otroTipo} onChange={(e) => setOtroTipo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (otroTipo.trim()) { set("tipoLocal", otroTipo.trim()); setOtroTipo(""); } } }}
            placeholder="Otro…"
            className="min-w-0 flex-1 rounded-xl border-2 border-magenta-100 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-magenta"
          />
        </div>
      </Bloque>

      <Bloque icono={Users} titulo="Aforo" pista="Cuánta gente cabe. El tamaño lo deducimos de aquí.">
        <div className="flex items-center gap-3">
          <input
            value={adn.aforo}
            onChange={(e) => set("aforo", e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric" placeholder="Ej: 250"
            className="w-36 rounded-xl border-2 border-magenta-100 bg-white px-4 py-2.5 font-semibold outline-none focus:border-magenta"
          />
          {tamano && (
            <span className="rounded-full bg-magenta-50 px-3 py-1.5 text-sm font-extrabold text-magenta-700">{tamano}</span>
          )}
        </div>
      </Bloque>

      <Bloque icono={LayoutGrid} titulo="Espacios" pista="Varios a la vez.">
        <div className="flex flex-wrap gap-2">
          {ESPACIOS.map((v) => (
            <button key={v} type="button" onClick={() => alternar("espacios", v)}
              className={chip(adn.espacios.some((x) => mismoValor(x, v)))}>{v}</button>
          ))}
        </div>
      </Bloque>

      <Bloque icono={Music} titulo="Música habitual" pista="Lo que suena aquí de normal, no lo de una noche suelta.">
        <SelectorEstilos valor={adn.musica} onChange={(v) => set("musica", v)} />
      </Bloque>

      <Bloque icono={Sparkles} titulo="Ambiente">
        <div className="flex flex-wrap gap-2">
          {AMBIENTES.map((v) => (
            <button key={v} type="button" onClick={() => alternar("ambiente", v)}
              className={chip(adn.ambiente.some((x) => mismoValor(x, v)))}>{v}</button>
          ))}
        </div>
      </Bloque>

      <Bloque icono={Users} titulo="Público habitual">
        <div className="flex flex-wrap gap-2">
          {PUBLICOS.map((v) => (
            <button key={v} type="button" onClick={() => alternar("publico", v)}
              className={chip(adn.publico.some((x) => mismoValor(x, v)))}>{v}</button>
          ))}
        </div>
      </Bloque>

      <Bloque icono={Shirt} titulo="Cómo se viene vestido">
        <div className="flex flex-wrap gap-2">
          {DRESS_CODES.map((v) => (
            <button key={v} type="button" onClick={() => set("dressCode", mismoValor(adn.dressCode, v) ? "" : v)}
              className={chip(mismoValor(adn.dressCode, v))}>{v}</button>
          ))}
        </div>
      </Bloque>

      <Bloque icono={Clock} titulo="Horario habitual" pista="Como lo dirías tú: «Vie a Dom, 18:00–02:00».">
        <input
          value={adn.horarioHabitual}
          onChange={(e) => set("horarioHabitual", e.target.value)}
          placeholder="Vie a Dom, 18:00–02:00"
          className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-2.5 font-semibold outline-none focus:border-magenta"
        />
      </Bloque>
    </div>
  );
}
