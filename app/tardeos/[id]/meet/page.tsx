"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, MoreVertical, Pin, SendHorizontal, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver } from "@/lib/volver";
import Boton from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import { claseCampo } from "@/components/ui/Campo";
import Denunciar from "@/components/comunidad/Denunciar";
import {
  estadoMeet, mensajesMeet, enviarMeet, fijarMeet, perfilesPublicos, pareceContacto, textoError,
  horaCorta, fechaCorta, type EstadoMeet, type MensajeMeet, type PerfilPublico,
} from "@/lib/meet";

/**
 * Meet Zone: el chat de un evento (dossier pág. 6). Solo entran los
 * confirmados, el organizador y el equipo; cierra 72 h después del fin. Todo
 * eso lo decide la base (lote 66): si alguien llega por enlace directo sin
 * permiso o con el chat cerrado, la base no le devuelve nada y aquí se explica.
 */
export default function MeetZone() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [estado, setEstado] = useState<EstadoMeet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeMeet[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, PerfilPublico>>({});
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [denunciar, setDenunciar] = useState<string | null>(null);
  const [verPerfil, setVerPerfil] = useState<string | null>(null);
  const [fijando, setFijando] = useState(false);
  const [textoFijado, setTextoFijado] = useState("");
  const [errFijado, setErrFijado] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const perfilesRef = useRef(perfiles);
  useEffect(() => { perfilesRef.current = perfiles; }, [perfiles]);

  const completarPerfiles = useCallback(async (ids: string[]) => {
    const faltan = [...new Set(ids)].filter((i) => !perfilesRef.current[i]);
    if (faltan.length === 0) return;
    const nuevos = await perfilesPublicos(faltan);
    setPerfiles((p) => ({ ...p, ...nuevos }));
  }, []);

  const cargar = useCallback(async () => {
    const r = await estadoMeet(id);
    if (r.error) { setError(textoError(r.error)); return; }
    setError(null);
    setEstado(r.estado);
    if (r.estado && ["organizador", "admin", "participante"].includes(r.estado.acceso)) {
      const m = await mensajesMeet(id);
      if (m.error) { setError(textoError(m.error)); return; }
      setMensajes(m.mensajes);
      completarPerfiles(m.mensajes.map((x) => x.autor));
    } else {
      setMensajes([]);
    }
  }, [id, completarPerfiles]);

  useEffect(() => {
    if (loading || !user) return;
    // Carga inicial desde la base (sistema externo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // Al volver a la pestaña se revalida: el chat puede haber cerrado o algún
    // mensaje puede haberse retenido mientras tanto.
    const alVolver = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [loading, user, cargar]);

  const dentro = !!estado && ["organizador", "admin", "participante"].includes(estado.acceso);

  // Tiempo real: la RLS de meet_mensajes también filtra lo que llega por aquí.
  useEffect(() => {
    if (!dentro) return;
    const canal = supabase.channel(`meet:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "meet_mensajes", filter: `tardeo_id=eq.${id}` },
        (p) => {
          const m = p.new as MensajeMeet;
          setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          completarPerfiles([m.autor]);
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [dentro, id, completarPerfiles]);

  useEffect(() => { finRef.current?.scrollIntoView({ block: "end" }); }, [mensajes.length]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    if (pareceContacto(t)) { setAviso("No se pueden compartir teléfonos ni emails en el chat."); return; }
    setEnviando(true); setAviso(null);
    const r = await enviarMeet(id, t);
    setEnviando(false);
    if (r.error) {
      setAviso(textoError(r.error));
      // Si el chat ha cerrado mientras escribía (o le han quitado el acceso),
      // se vuelve a pedir el estado para enseñar la explicación correcta.
      cargar();
      return;
    }
    setTexto("");
    if (r.mensaje) setMensajes((prev) => (prev.some((x) => x.id === r.mensaje!.id) ? prev : [...prev, r.mensaje!]));
  }

  async function guardarFijado() {
    setErrFijado(null);
    const r = await fijarMeet(id, textoFijado);
    if (r.error) { setErrFijado(textoError(r.error)); return; }
    setFijando(false);
    cargar();
  }

  const volver = `/tardeos/${id}`;
  const cabecera = (
    <header className="sticky top-0 z-[700] flex items-center gap-2 border-b border-linea bg-superficie/95 px-2 py-1.5 backdrop-blur">
      <Link href={volver} aria-label="Volver al evento" className="grid min-h-tacto min-w-tacto place-items-center rounded-full hover:bg-marfil-100">
        <ArrowLeft size={22} aria-hidden />
      </Link>
      <h1 className="flex-1 text-center text-lg font-bold">Meet Zone</h1>
      <span className="min-w-tacto" aria-hidden />
    </header>
  );

  // ---- Estados sin chat -----------------------------------------------------
  if (loading || (user && !estado && !error)) {
    return <div className="min-h-[60vh] bg-fondo">{cabecera}<p className="grid place-items-center py-16 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p></div>;
  }
  if (!user) {
    return (
      <div className="min-h-[60vh] bg-fondo">{cabecera}
        <Explicacion titulo="Entra para ver el chat" texto="La Meet Zone es gratis para quien tiene plaza confirmada en el evento.">
          <Boton href={entrarYVolver(`/tardeos/${id}/meet`)} ancho>Entrar</Boton>
        </Explicacion>
      </div>
    );
  }
  if (error) {
    return <div className="min-h-[60vh] bg-fondo">{cabecera}<Explicacion titulo="No se pudo abrir el chat" texto={error}><Boton variante="contorno" onClick={cargar} ancho>Reintentar</Boton></Explicacion></div>;
  }
  if (!dentro) {
    const a = estado?.acceso;
    const txt: Record<string, [string, string]> = {
      no_existe: ["Este evento no existe", "Puede que lo hayan retirado."],
      cerrado: ["Chat cerrado", "La Meet Zone se cierra 72 horas después del final del evento. Ya no se puede leer ni escribir."],
      espera: ["Estás en lista de espera", "Cuando se libere una plaza y quedes confirmado, podrás entrar en la Meet Zone."],
      no_confirmado: ["Solo para confirmados", "Pulsa Asistiré en el evento. Con tu plaza confirmada podrás hablar con quienes van. Guardar el evento o comprar en la ticketera no da acceso."],
    };
    const [t, d] = txt[a ?? "no_existe"] ?? txt.no_existe;
    return (
      <div className="min-h-[60vh] bg-fondo">{cabecera}
        <Explicacion titulo={t} texto={d} icono>
          <Boton href={volver} variante="contorno" ancho>Ver el evento</Boton>
        </Explicacion>
      </div>
    );
  }

  // ---- Chat -------------------------------------------------------------------
  const e = estado!;
  const esOrganizador = e.acceso === "organizador" || e.acceso === "admin";
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-fondo">
      {cabecera}
      <div className="border-b border-linea bg-marfil-100 px-4 py-2">
        <p className="truncate text-[16px] font-bold">{e.titulo}</p>
        <p className="text-[13px] text-tinta-suave">
          {e.participantes ?? 0} participantes · Hasta 72 h después del evento
          {e.cierra_en && <> (cierra {fechaCorta(e.cierra_en)} {horaCorta(e.cierra_en)})</>}
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-4 py-4">
        {e.estado_evento === "cancelado" && (
          <p className="rounded-2xl border border-error/30 bg-error-fondo px-4 py-3 text-[15px] font-semibold text-error">
            Evento cancelado. El chat queda en solo lectura.
          </p>
        )}
        {(e.fijado || esOrganizador) && (
          <div className="rounded-2xl bg-oro/25 px-4 py-3">
            <p className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide text-aviso"><Pin size={13} aria-hidden /> Mensaje del organizador</p>
            {e.fijado ? <p className="mt-1 whitespace-pre-wrap text-[15px]">{e.fijado}</p>
              : <p className="mt-1 text-[15px] text-tinta-suave">Aún no hay mensaje fijado. Pon el punto de encuentro y datos prácticos.</p>}
            {esOrganizador && (
              <button type="button" onClick={() => { setTextoFijado(e.fijado ?? ""); setErrFijado(null); setFijando(true); }}
                className="mt-2 min-h-[44px] text-[15px] font-bold text-magenta underline">
                {e.fijado ? "Cambiar mensaje fijado" : "Fijar un mensaje"}
              </button>
            )}
          </div>
        )}

        {mensajes.length === 0 && <p className="py-8 text-center text-[15px] text-tinta-suave">Todavía no hay mensajes. ¡Saluda!</p>}

        {mensajes.map((m, i) => {
          const mio = m.autor === user.id;
          const p = perfiles[m.autor];
          const esOrg = m.autor === e.organizador;
          const d = fechaCorta(m.created_at);
          // Separador de día cuando cambia respecto al mensaje anterior.
          const separador = i === 0 || fechaCorta(mensajes[i - 1].created_at) !== d ? d : null;
          return (
            <div key={m.id}>
              {separador && <p className="my-2 text-center text-[12px] text-tinta-suave">{separador}</p>}
              <div className={`flex items-start gap-1 ${mio ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mio ? "bg-magenta-50" : "bg-marfil-100"} ${m.retenido ? "opacity-60" : ""}`}>
                  {!mio && (
                    <button type="button" onClick={() => setVerPerfil(m.autor)} className="text-[13px] font-bold text-magenta">
                      {p?.alias ?? "…"}{esOrg && " · Organizador"}
                    </button>
                  )}
                  <p className="whitespace-pre-wrap break-words text-[15px]">{m.texto}</p>
                  <p className="text-right text-[11px] text-tinta-suave">
                    {m.retenido && "Retenido para revisión · "}{horaCorta(m.created_at)}
                  </p>
                </div>
                {!mio && (
                  <button type="button" aria-label="Denunciar mensaje" onClick={() => setDenunciar(m.id)}
                    className="grid min-h-[44px] min-w-[36px] place-items-center text-tinta-suave hover:text-error">
                    <MoreVertical size={18} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom)+var(--alto-mini,0px))] z-[600] border-t border-linea bg-superficie px-3 py-2 md:bottom-0">
        {e.puede_escribir ? (
          <form onSubmit={enviar} className="mx-auto flex max-w-2xl items-center gap-2">
            <label htmlFor="meet-texto" className="sr-only">Mensaje</label>
            <input id="meet-texto" className={`${claseCampo} rounded-full`} placeholder="Escribe un mensaje…" maxLength={500}
              value={texto} onChange={(ev) => { setTexto(ev.target.value); setAviso(null); }} autoComplete="off" />
            <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar"
              className="grid min-h-tacto min-w-tacto place-items-center rounded-full bg-magenta text-white disabled:opacity-50">
              {enviando ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <SendHorizontal size={20} aria-hidden />}
            </button>
          </form>
        ) : (
          <p className="mx-auto flex max-w-2xl items-center gap-2 py-2 text-[15px] text-tinta-suave"><Lock size={16} aria-hidden /> Solo lectura.</p>
        )}
        {aviso && <p role="alert" className="mx-auto mt-1 max-w-2xl text-[14px] font-semibold text-error">{aviso}</p>}
      </div>

      {denunciar && <Denunciar abierta onCerrar={() => setDenunciar(null)} tipo="meet_mensaje" objetoId={denunciar} />}

      <Hoja abierta={!!verPerfil} onCerrar={() => setVerPerfil(null)} titulo={perfiles[verPerfil ?? ""]?.alias ?? "Perfil"}>
        {verPerfil && (
          <div className="flex items-start gap-3">
            {perfiles[verPerfil]?.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={perfiles[verPerfil]!.avatar_url!} alt="" className="h-16 w-16 rounded-full object-cover" />
              : <span className="grid h-16 w-16 place-items-center rounded-full bg-magenta-50 text-xl font-bold text-magenta">{(perfiles[verPerfil]?.alias ?? "?").slice(0, 1)}</span>}
            <div>
              <p className="text-[16px] font-bold">{perfiles[verPerfil]?.alias}</p>
              <p className="text-[15px] text-tinta-suave">{perfiles[verPerfil]?.bio || "Sin presentación."}</p>
            </div>
          </div>
        )}
      </Hoja>

      <Hoja abierta={fijando} onCerrar={() => setFijando(false)} titulo="Mensaje fijado"
        pie={<Boton ancho onClick={guardarFijado}>{textoFijado.trim() ? "Fijar mensaje" : "Quitar mensaje fijado"}</Boton>}>
        <p className="mb-2 text-[15px] text-tinta-suave">Punto de encuentro, hora y datos prácticos. Lo verán todos arriba del chat. Sin teléfonos ni emails.</p>
        <textarea className={claseCampo} rows={4} maxLength={400} value={textoFijado} onChange={(ev) => setTextoFijado(ev.target.value)} />
        {errFijado && <p role="alert" className="mt-2 text-[15px] font-semibold text-error">{errFijado}</p>}
      </Hoja>
    </div>
  );
}

function Explicacion({ titulo, texto, children, icono }: { titulo: string; texto: string; children?: React.ReactNode; icono?: boolean }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      {icono && <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-magenta-50 text-magenta"><Lock size={24} aria-hidden /></span>}
      <h2 className="text-xl font-bold">{titulo}</h2>
      <p className="mt-2 text-[16px] text-tinta-suave">{texto}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
