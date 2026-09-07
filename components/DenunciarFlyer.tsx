"use client";

import { useState } from "react";
import { Flag, Loader2, Check, X } from "lucide-react";
import { MOTIVOS, denunciarFlyer, type Motivo } from "@/lib/denuncias";

/**
 * «Avisar de un problema con este flyer».
 *
 * Discreto a propósito. Va al final de la ficha, en letra pequeña y sin color
 * de alarma: la inmensa mayoría de los flyers están bien, y un botón rojo de
 * denunciar en cada tardeo convierte una web de fiestas en un foro de quejas.
 * Quien lo necesita, lo encuentra.
 *
 * No hace falta cuenta. Una imagen ofensiva la tiene que poder reportar quien
 * pasaba por ahí, y obligar a registrarse para eso garantiza que nadie lo haga.
 */
export default function DenunciarFlyer({
  tardeoId, flyerUrl,
}: {
  tardeoId: string;
  flyerUrl: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState("");

  const enviar = async () => {
    if (!motivo) return;
    setEnviando(true); setError("");
    const r = await denunciarFlyer(tardeoId, motivo, mensaje, flyerUrl);
    setEnviando(false);
    if (!r.ok) { setError(r.error ?? "No se pudo enviar."); return; }
    setHecho(true);
  };

  if (hecho) {
    return (
      <p className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-tinta/60">
        <Check size={16} className="text-green-600" />
        Gracias. Lo revisamos y, si hace falta, retiramos el flyer.
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mx-auto mt-6 flex items-center gap-1.5 text-xs font-bold text-tinta/40 underline underline-offset-2 transition hover:text-magenta"
      >
        <Flag size={12} /> Avisar de un problema con este flyer
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-black">¿Qué pasa con este flyer?</p>
          <p className="text-sm font-semibold text-tinta/55">
            Lo mira una persona. No hace falta que tengas cuenta.
          </p>
        </div>
        <button onClick={() => setAbierto(false)} aria-label="Cerrar"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-tinta/40 hover:bg-black/5">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {MOTIVOS.map((m) => (
          <button
            key={m.k}
            onClick={() => setMotivo(m.k)}
            className={`rounded-xl px-3 py-2.5 text-left transition ${
              motivo === m.k ? "bg-magenta-50 ring-2 ring-magenta" : "bg-black/[0.03] hover:bg-black/[0.06]"}`}
          >
            <span className="block text-sm font-black">{m.label}</span>
            <span className="block text-xs font-semibold text-tinta/50">{m.ayuda}</span>
          </button>
        ))}
      </div>

      <textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Cuéntanos algo más (opcional)"
        className="mt-3 w-full resize-y rounded-xl border-2 border-magenta-100 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-magenta"
      />

      {error && <p className="mt-2 text-sm font-bold text-magenta">{error}</p>}

      <button
        onClick={enviar}
        disabled={!motivo || enviando}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-magenta py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {enviando ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
        Enviar aviso
      </button>
    </div>
  );
}
