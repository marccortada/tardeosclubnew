"use client";

import { useState } from "react";
import { claseCampo } from "@/components/ui/Campo";
import { claseBoton } from "@/components/Boton";
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
      <p className="mt-8 flex items-center justify-center gap-2 text-[15px] text-tinta-suave">
        <Check size={16} className="text-ok" />
        Gracias. Lo revisamos y, si hace falta, retiramos el flyer.
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mx-auto mt-8 flex min-h-[44px] items-center gap-1.5 px-2 text-[14px] font-semibold text-tinta-suave underline underline-offset-2 transition hover:text-tinta"
      >
        <Flag size={12} /> Avisar de un problema con este flyer
      </button>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">¿Qué pasa con este flyer?</p>
          <p className="text-[15px] text-tinta-suave">
            Lo mira una persona. No hace falta que tengas cuenta.
          </p>
        </div>
        <button onClick={() => setAbierto(false)} aria-label="Cerrar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-tinta-suave hover:bg-marfil-100">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {MOTIVOS.map((m) => (
          <button
            key={m.k}
            onClick={() => setMotivo(m.k)}
            aria-pressed={motivo === m.k}
            className={`min-h-[48px] rounded-xl border px-3 py-2.5 text-left transition ${
              motivo === m.k ? "border-magenta bg-magenta-50" : "border-transparent bg-marfil-100 hover:bg-marfil-200"}`}
          >
            <span className="block text-[15px] font-bold">{m.label}</span>
            <span className="block text-[14px] text-tinta-suave">{m.ayuda}</span>
          </button>
        ))}
      </div>

      <textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Cuéntanos algo más (opcional)"
        className={`mt-3 ${claseCampo}`}
      />

      {error && <p role="alert" className="mt-2 text-[15px] font-semibold text-error">{error}</p>}

      <button
        onClick={enviar}
        disabled={!motivo || enviando}
        className={claseBoton("primario", "pequeno", true, "mt-3")}
      >
        {enviando ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
        Enviar aviso
      </button>
    </div>
  );
}
