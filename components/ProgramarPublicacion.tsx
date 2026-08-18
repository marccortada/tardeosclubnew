"use client";

import { Clock, Send, FileText } from "lucide-react";

export type Cuando = { estado: "publicado" | "programado" | "borrador"; publicarEn: string };

/** Hora local para un <input type="datetime-local">, que no admite zona. */
export function paraInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Cuándo sale el tardeo: ahora, a una hora, o se queda guardado.
 *
 * Existe para que un local pueda preparar el mes entero de una sentada y que
 * cada flyer salga cuando toca, en vez de tener que acordarse de entrar el
 * viernes por la mañana.
 *
 * "Guardar sin publicar" no es lo mismo que programar y por eso son opciones
 * distintas: el borrador no tiene fecha de salida y no se le olvida a nadie
 * porque no se espera nada de él.
 */
export default function ProgramarPublicacion({
  valor,
  onCambio,
}: {
  valor: Cuando;
  onCambio: (c: Cuando) => void;
}) {
  const OPCIONES = [
    { k: "publicado", icono: Send, label: "Publicar ya", pie: "Sale en cuanto le des" },
    { k: "programado", icono: Clock, label: "Programar", pie: "Sale solo a la hora que digas" },
    { k: "borrador", icono: FileText, label: "Guardar", pie: "Sin publicar, para seguir luego" },
  ] as const;

  // Por defecto, mañana a las 10:00: una hora en la que la gente mira el móvil,
  // y no "ahora mismo", que sería lo mismo que publicar ya.
  const porDefecto = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return paraInput(d);
  };

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
        <Clock size={15} className="text-magenta" /> Cuándo se publica
      </p>
      <div className="grid grid-cols-3 gap-2">
        {OPCIONES.map(({ k, icono: Icono, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => onCambio({ estado: k, publicarEn: k === "programado" ? (valor.publicarEn || porDefecto()) : "" })}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-extrabold transition ${
              valor.estado === k ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"
            }`}
          >
            <Icono size={17} /> {label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs font-semibold text-tinta/50">
        {OPCIONES.find((o) => o.k === valor.estado)?.pie}
      </p>

      {valor.estado === "programado" && (
        <div className="mt-2">
          <input
            type="datetime-local"
            value={valor.publicarEn}
            // No se puede programar para atrás: saldría al instante y el local
            // creería que ha programado algo.
            min={paraInput(new Date())}
            onChange={(e) => onCambio({ ...valor, publicarEn: e.target.value })}
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
          />
          <p className="mt-1 text-xs font-semibold text-tinta/50">
            Hasta esa hora solo lo ves tú. Puedes cambiarlo o publicarlo antes cuando quieras.
          </p>
        </div>
      )}
    </div>
  );
}
