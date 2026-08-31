"use client";

import { useCallback, useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { BellRing, Send, Loader2, Check, Users } from "lucide-react";
import SelectorSegmento, { SIN_SEGMENTAR, haySegmento, type Segmento } from "@/components/SelectorSegmento";

/**
 * Megáfono del admin: manda una notificación push a todos los dispositivos que
 * las hayan aceptado. A diferencia del popup (que espera a que el visitante
 * entre en la web), esto le suena en el móvil aunque la tenga cerrada.
 */
export default function AdminNotificaciones() {
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ enviadas: number; caducadas: number } | null>(null);
  const [error, setError] = useState("");
  const [segmento, setSegmento] = useState<Segmento>(SIN_SEGMENTAR);
  const [cuenta, setCuenta] = useState<{ destinatarias: number; total: number } | null>(null);

  /**
   * A cuántos va a llegar, ANTES de darle al botón.
   *
   * Quien manda un aviso a móviles ajenos tiene que ver el número antes, no
   * después. Y con segmento puesto es el número que dice si el criterio es
   * demasiado estrecho: "llegará a 0 de 40" se ve a tiempo.
   */
  const contar = useCallback(async (seg: Segmento) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/push/enviar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "contar", soloContar: true, segmento: seg, accessToken: session?.access_token }),
    });
    if (res.ok) setCuenta(await res.json()); else setCuenta(null);
  }, []);
  useEffect(() => { contar(segmento); }, [contar, segmento]);

  const enviar = async () => {
    if (!titulo.trim()) return;
    setEnviando(true); setError(""); setResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/push/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          mensaje: mensaje.trim(),
          url: "/tardeos",
          segmento,
          accessToken: session?.access_token,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo enviar.");
      setResultado(j);
      setTitulo(""); setMensaje(""); contar(segmento);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="pb-10">
      <PanelHeader titulo="Notificaciones push" volverHref="/admin" />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        {/* Vista previa, imitando una notificación del sistema */}
        <p className="mb-2 text-sm font-black text-tinta/60">Así les sonará en el móvil</p>
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-tinta p-4 text-white shadow-tarjeta">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10">
            <BellRing size={20} className="text-oro-400" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-black leading-tight">{titulo || "Título de la notificación"}</p>
            <p className="text-sm font-semibold text-white/80">{mensaje || "El mensaje que verán sin abrir la app."}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
          <label className="mb-1 block text-sm font-black text-tinta/70">Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="¡Nuevo tardeo este sábado!"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />
          <label className="mb-1 mt-3 block text-sm font-black text-tinta/70">Mensaje</label>
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} placeholder="Remember en la Sala Blau desde las 18:00…"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />
          <p className="mt-2 text-xs font-semibold text-tinta/50">
            Al tocarla se abre la lista de tardeos. Úsalo con cariño: el que recibe tres avisos
            que no van con él desactiva el cuarto.
          </p>

          <div className="mt-4 border-t border-black/5 pt-4">
            <p className="mb-2 text-sm font-black text-tinta/70">¿A quién?</p>
            <p className="mb-3 text-xs font-semibold text-tinta/50">
              Sin marcar nada, va a todos. Lo que marques se exige a la vez: «Remember» + «Maresme»
              es a quien le gusta el remember <em>y</em> sale por el Maresme.
            </p>
            <SelectorSegmento valor={segmento} onCambio={setSegmento} />
          </div>

          {/* Cuántos lo recibirán, ANTES de darle. Con criterios estrechos, un
              "0 de 3" se ve a tiempo de aflojarlos. */}
          {cuenta && (
            <p className={`mt-4 flex items-center gap-1.5 rounded-xl p-3 text-sm font-black ${
              cuenta.destinatarias === 0 ? "bg-amber-50 text-amber-900" : "bg-magenta-50 text-magenta-700"}`}>
              <Users size={16} className="shrink-0" />
              {cuenta.destinatarias === 0
                ? haySegmento(segmento)
                  ? `Nadie encaja con esos criterios (hay ${cuenta.total} suscritos). Marca menos cosas.`
                  : "Todavía no hay nadie suscrito a las notificaciones."
                : haySegmento(segmento)
                  ? `Llegará a ${cuenta.destinatarias} de ${cuenta.total} suscritos.`
                  : `Llegará a los ${cuenta.destinatarias} suscritos.`}
            </p>
          )}

          <button onClick={enviar} disabled={enviando || !titulo.trim() || cuenta?.destinatarias === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40">
            {enviando ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {haySegmento(segmento)
              ? `Enviar a ${cuenta?.destinatarias ?? "…"}`
              : "Enviar a todos"}
          </button>
          {resultado && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-black text-oro-600">
              <Check size={16} /> Enviadas: {resultado.enviadas}
              {resultado.caducadas > 0 && ` · ${resultado.caducadas} suscripciones caducadas retiradas`}
            </p>
          )}
          {error && <p className="mt-3 text-center text-sm font-bold text-magenta">{error}</p>}
        </div>
      </div>
    </main>
  );
}
