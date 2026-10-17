"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import SelectorSegmento, { SIN_SEGMENTAR, haySegmento, type Segmento } from "@/components/SelectorSegmento";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import Tarjeta from "@/components/ui/Tarjeta";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";
import { BellRing, Send, Users } from "lucide-react";

/**
 * Misma regla que `urlInternaSegura` en el servidor: solo rutas de la propia
 * app. Se comprueba aquí también para avisar ANTES de enviar; si no, el
 * servidor la cambiaría en silencio por /tardeos y nadie se enteraría.
 */
const rutaValida = (u: string) =>
  u.startsWith("/") && u[1] !== "/" && u[1] !== "\\" && !/[\s\u0000-\u001f]/.test(u) && u.length <= 500;

const DESTINOS = [
  { url: "/tardeos", label: "Lista de tardeos" },
  { url: "/", label: "Portada" },
  { url: "/mapa", label: "Mapa" },
];

/**
 * Megáfono del admin: manda una notificación push a todos los dispositivos que
 * las hayan aceptado. A diferencia del popup (que espera a que el visitante
 * entre en la web), esto le suena en el móvil aunque la tenga cerrada.
 */
export default function AdminNotificaciones() {
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [url, setUrl] = useState("/tardeos");
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<{ enviadas: number; caducadas: number; destinatarias?: number } | null>(null);
  const [error, setError] = useState("");
  const [segmento, setSegmento] = useState<Segmento>(SIN_SEGMENTAR);
  const [cuenta, setCuenta] = useState<{ destinatarias: number; total: number } | null>(null);
  const [errorCuenta, setErrorCuenta] = useState("");

  /**
   * A cuántos va a llegar, ANTES de darle al botón.
   *
   * Quien manda un aviso a móviles ajenos tiene que ver el número antes, no
   * después. Y con segmento puesto es el número que dice si el criterio es
   * demasiado estrecho: "llegará a 0 de 40" se ve a tiempo.
   */
  const contar = useCallback(async (seg: Segmento) => {
    setErrorCuenta("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/push/enviar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: "contar", soloContar: true, segmento: seg, accessToken: session?.access_token }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setCuenta(j);
      else { setCuenta(null); setErrorCuenta(j.error || "No se pudo saber a cuántos llegará."); }
    } catch {
      setCuenta(null); setErrorCuenta("No se pudo saber a cuántos llegará.");
    }
  }, []);
  useEffect(() => { contar(segmento); }, [contar, segmento]);

  const urlLimpia = url.trim();
  const urlMal = !rutaValida(urlLimpia);

  const enviar = async () => {
    if (!titulo.trim() || urlMal) return;
    setEnviando(true); setError(""); setResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/push/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          mensaje: mensaje.trim(),
          url: urlLimpia,
          segmento,
          accessToken: session?.access_token,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "No se pudo enviar.");
      setResultado(j);
      setTitulo(""); setMensaje(""); contar(segmento);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  };

  const n = cuenta?.destinatarias;
  const puede = Boolean(titulo.trim()) && !urlMal && n !== undefined && n > 0;

  return (
    <SeccionPanel
      titulo="Notificaciones push"
      descripcion="Le suena en el móvil a quien las haya aceptado, aunque tenga la web cerrada. Úsalo con cariño: quien recibe tres avisos que no van con él desactiva el cuarto."
      ancho="estrecho"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          <Tarjeta className="flex flex-col gap-4">
            <Campo etiqueta="Título" htmlFor="pu-titulo">
              <input id="pu-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={60}
                placeholder="¡Nuevo tardeo este sábado!" className={claseCampo} />
            </Campo>
            <Campo etiqueta="Mensaje" htmlFor="pu-mensaje" ayuda="Lo que se lee sin abrir la app. Una frase.">
              <textarea id="pu-mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} maxLength={160}
                placeholder="Remember en la Sala Blau desde las 18:00" className={claseCampo} />
            </Campo>
            <Campo etiqueta="Al tocarla, abre" htmlFor="pu-url"
              error={urlMal ? "Tiene que ser una página de TardeosClub: empieza por «/» (por ejemplo /tardeos/123)." : null}
              ayuda="Una página de TardeosClub. Copia la parte de la dirección que va después del dominio.">
              <input id="pu-url" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url"
                className={claseCampo} aria-invalid={urlMal} />
            </Campo>
            <div className="-mt-2 flex flex-wrap gap-2">
              {DESTINOS.map((d) => (
                <button key={d.url} type="button" onClick={() => setUrl(d.url)} aria-pressed={urlLimpia === d.url}
                  className={`min-h-[44px] rounded-full border px-4 text-[15px] font-semibold transition-colors ${
                    urlLimpia === d.url ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white hover:border-tinta/50"}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">¿A quién?</h2>
            <p className="text-[15px] text-tinta-suave">
              Sin marcar nada, va a todos. Lo que marques se exige a la vez: «Remember» + «Maresme» es a quien le gusta el
              remember <strong>y</strong> sale por el Maresme. Quien no ha dicho sus gustos no recibe avisos segmentados.
            </p>
            <SelectorSegmento valor={segmento} onCambio={setSegmento} />
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-3 md:sticky md:top-4 md:self-start">
          {/* Vista previa, imitando una notificación del sistema */}
          <p className="text-[15px] font-semibold text-tinta-suave">Así se verá en el móvil</p>
          <div className="flex items-start gap-3 rounded-2xl bg-noche p-4 text-white shadow-tarjeta">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
              <BellRing size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] text-white/70">TardeosClub · ahora</p>
              <p className="truncate font-bold leading-tight">{titulo || "Título de la notificación"}</p>
              <p className="text-[15px] text-white/85">{mensaje || "El mensaje que verán sin abrir la app."}</p>
            </div>
          </div>
          <p className="text-sm text-tinta-suave">Al tocarla abre <strong className="break-all">{urlMal ? "—" : urlLimpia}</strong></p>

          {/* Cuántos lo recibirán, ANTES de darle. Con criterios estrechos, un
              "0 de 3" se ve a tiempo de aflojarlos. */}
          {cuenta && (
            <p className={`flex items-start gap-2 rounded-xl p-3 text-[15px] font-semibold ${
              cuenta.destinatarias === 0 ? "bg-aviso-fondo text-aviso" : "bg-magenta-50 text-magenta-700"}`}>
              <Users size={18} className="mt-0.5 shrink-0" aria-hidden />
              {cuenta.destinatarias === 0
                ? haySegmento(segmento)
                  ? `Nadie encaja con esos criterios (hay ${cuenta.total} suscritos). Marca menos cosas.`
                  : "Todavía no hay nadie suscrito a las notificaciones."
                : haySegmento(segmento)
                  ? `Llegará a ${cuenta.destinatarias} de ${cuenta.total} suscritos.`
                  : `Llegará a los ${cuenta.destinatarias} suscritos.`}
            </p>
          )}
          {errorCuenta && <Aviso tono="error">{errorCuenta}</Aviso>}
          {error && <Aviso tono="error">{error}</Aviso>}
          {resultado && (
            <Aviso tono="ok">
              Enviadas: {resultado.enviadas}
              {resultado.destinatarias != null && resultado.destinatarias > resultado.enviadas && ` de ${resultado.destinatarias}`}.
              {resultado.caducadas > 0 && ` Se retiraron ${resultado.caducadas} suscripciones caducadas.`}
            </Aviso>
          )}

          <Boton ancho disabled={!puede} cargando={enviando} onClick={() => { setResultado(null); setError(""); setConfirmando(true); }}>
            <Send size={20} aria-hidden /> {n ? `Enviar a ${n}` : "Enviar"}
          </Boton>
          {!titulo.trim() && <p className="text-center text-sm text-tinta-suave">Escribe un título para poder enviar.</p>}
        </div>
      </div>

      <Hoja abierta={confirmando} onCerrar={() => !enviando && setConfirmando(false)} titulo="¿Enviar la notificación?"
        pie={
          <div className="grid gap-2">
            <Boton ancho cargando={enviando} onClick={enviar}><Send size={20} aria-hidden /> Sí, enviar a {n}</Boton>
            <Boton ancho variante="contorno" disabled={enviando} onClick={() => setConfirmando(false)}>Todavía no</Boton>
          </div>
        }>
        <p className="text-base">
          Vas a enviar a <strong>{n} {n === 1 ? "persona" : "personas"}</strong>
          {haySegmento(segmento) ? " (con los criterios que has marcado)" : " (todos los suscritos)"}. Les sonará en el móvil y no se puede deshacer.
        </p>
        <div className="mt-3 rounded-2xl border border-linea bg-marfil p-4">
          <p className="font-bold">{titulo}</p>
          {mensaje && <p className="mt-1 text-[15px] text-tinta-suave">{mensaje}</p>}
          <p className="mt-2 text-sm text-tinta-suave">Abre: <span className="break-all font-semibold text-tinta">{urlLimpia}</span></p>
        </div>
      </Hoja>
    </SeccionPanel>
  );
}
