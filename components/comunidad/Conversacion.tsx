"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MoreVertical, SendHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { claseCampo } from "@/components/ui/Campo";
import Denunciar from "@/components/comunidad/Denunciar";
import { enviarMensajeDj, mensajesDe, type MensajeDj } from "@/lib/mensajes";
import { horaCorta, fechaCorta, pareceContacto, textoError } from "@/lib/meet";

/**
 * Conversación tardícola ↔ DJ (ya aceptada). La usan /mensajes y
 * /dj/mensajes. El primer mensaje es el de la solicitud. Tiempo real con la
 * misma RLS que la lectura: si el DJ bloquea, deja de llegar nada.
 */
export default function Conversacion({
  conversacion, yo, primero, nombreOtro, activa,
}: { conversacion: string; yo: string; primero: { autor: string; texto: string; created_at: string }; nombreOtro: string; activa: boolean }) {
  const [mensajes, setMensajes] = useState<MensajeDj[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [denunciar, setDenunciar] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    mensajesDe(conversacion).then((r) => {
      if (!vivo) return;
      if (r.error) setError(textoError(r.error)); else setMensajes(r.mensajes);
      setCargando(false);
    });
    const canal = supabase.channel(`conv:${conversacion}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_dj", filter: `conversacion=eq.${conversacion}` },
        (p) => {
          const m = p.new as MensajeDj;
          setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        })
      .subscribe();
    return () => { vivo = false; supabase.removeChannel(canal); };
  }, [conversacion]);

  useEffect(() => { finRef.current?.scrollIntoView({ block: "end" }); }, [mensajes.length]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    if (pareceContacto(t)) { setError("No se pueden compartir teléfonos ni emails aquí."); return; }
    setEnviando(true); setError(null);
    const r = await enviarMensajeDj(conversacion, t);
    setEnviando(false);
    if (r.error) { setError(textoError(r.error)); return; }
    setTexto("");
    if (r.mensaje) setMensajes((prev) => (prev.some((x) => x.id === r.mensaje!.id) ? prev : [...prev, r.mensaje!]));
  }

  const todos = [{ id: "inicial", autor: primero.autor, texto: primero.texto, created_at: primero.created_at, retenido: false, conversacion }, ...mensajes];

  return (
    <div className="flex flex-col">
      <div className="space-y-3 py-3">
        {cargando && <p className="grid place-items-center py-6 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p>}
        {todos.map((m) => {
          const mio = m.autor === yo;
          return (
            <div key={m.id} className={`flex items-start gap-1 ${mio ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mio ? "bg-magenta-50" : "bg-marfil-100"}`}>
                {!mio && <p className="text-[13px] font-bold text-magenta">{nombreOtro}</p>}
                <p className="whitespace-pre-wrap break-words text-[15px]">{m.texto}</p>
                <p className="text-right text-[13px] text-tinta-suave">{m.retenido && "Retenido · "}{fechaCorta(m.created_at)} {horaCorta(m.created_at)}</p>
              </div>
              {!mio && m.id !== "inicial" && (
                <button type="button" aria-label="Denunciar mensaje" onClick={() => setDenunciar(m.id)}
                  className="grid min-h-[44px] min-w-[36px] place-items-center text-tinta-suave hover:text-error">
                  <MoreVertical size={18} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
        <div ref={finRef} />
      </div>
      {activa ? (
        <form onSubmit={enviar} className="flex items-center gap-2 border-t border-linea pt-3">
          <label htmlFor={`txt-${conversacion}`} className="sr-only">Mensaje</label>
          <input id={`txt-${conversacion}`} className={`${claseCampo} rounded-full`} placeholder="Escribe un mensaje…" maxLength={1000}
            value={texto} onChange={(ev) => { setTexto(ev.target.value); setError(null); }} autoComplete="off" />
          <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar"
            className="grid min-h-tacto min-w-tacto place-items-center rounded-full bg-magenta text-white disabled:opacity-50">
            {enviando ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <SendHorizontal size={20} aria-hidden />}
          </button>
        </form>
      ) : (
        <p className="border-t border-linea pt-3 text-[15px] text-tinta-suave">Esta conversación está cerrada.</p>
      )}
      {error && <p role="alert" className="mt-2 text-[14px] font-semibold text-error">{error}</p>}
      {denunciar && <Denunciar abierta onCerrar={() => setDenunciar(null)} tipo="mensaje_dj" objetoId={denunciar} />}
    </div>
  );
}
