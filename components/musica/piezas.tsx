"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, Pause, Loader2, Check, Plus, Send, Trash2, CornerDownRight } from "lucide-react";
import Hoja from "@/components/ui/Hoja";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver } from "@/lib/volver";
import { useReproductor } from "@/components/musica/Reproductor";
import {
  seguirDj, getComentarios, comentar, borrarComentario, portadaDe,
  type Comentario, type Plataforma,
} from "@/lib/sets";

/** Lo mínimo de un set para poder sonar. */
export type SetSonable = { id: string; titulo: string; url: string; plataforma?: Plataforma | null; portada?: string | null };

/** Botón ▶/❚❚ de un set: usa el reproductor global (nunca suena solo). */
export function BotonPlay({ set, autor, grande = false, className = "" }: { set: SetSonable; autor?: string; grande?: boolean; className?: string }) {
  const { actual, sonando, cargando, reproducir, alternar } = useReproductor();
  const esEste = actual?.id === set.id;
  const tam = grande ? "h-20 w-20" : "h-12 w-12";
  const ic = grande ? 36 : 22;
  return (
    <button
      type="button"
      aria-label={esEste && sonando ? `Pausar ${set.titulo}` : `Escuchar ${set.titulo}`}
      onClick={(e) => {
        e.stopPropagation();
        if (esEste) alternar();
        else reproducir({ id: set.id, titulo: set.titulo, autor, url: set.url, portada: portadaDe(set), tipo: "set", plataforma: set.plataforma ?? undefined });
      }}
      className={`grid shrink-0 place-items-center rounded-full transition active:scale-95 ${tam} ${className}`}
    >
      {esEste && cargando ? <Loader2 size={ic} className="animate-spin" aria-hidden />
        : esEste && sonando ? <Pause size={ic} aria-hidden fill="currentColor" />
        : <Play size={ic} aria-hidden fill="currentColor" className="translate-x-[2px]" />}
    </button>
  );
}

/** Seguir / ✓ Siguiendo. Sin sesión, lleva a entrar y vuelve aquí. */
export function BotonSeguir({
  djId, inicial, onCambio, className = "", oscuro = false,
}: { djId: string; inicial: boolean; onCambio?: (v: boolean) => void; className?: string; oscuro?: boolean }) {
  const { user } = useAuth();
  const [sigo, setSigo] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setSigo(inicial); }, [inicial]);

  if (!user) {
    const aqui = typeof window !== "undefined" ? window.location.pathname : `/djs/${djId}`;
    return (
      <Link href={entrarYVolver(aqui)} className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-magenta px-4 text-[15px] font-bold text-white ${className}`}>
        <Plus size={18} aria-hidden /> Seguir
      </Link>
    );
  }
  return (
    <>
      <button
        type="button" disabled={ocupado} aria-pressed={sigo}
        onClick={async () => {
          setOcupado(true); setError(null);
          const nuevo = !sigo;
          setSigo(nuevo);
          const e = await seguirDj(djId, user.id, nuevo);
          if (e) { setSigo(!nuevo); setError(e); } else onCambio?.(nuevo);
          setOcupado(false);
        }}
        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition active:scale-95 ${
          sigo ? (oscuro ? "bg-white/20 text-white" : "bg-magenta text-white") : "bg-magenta text-white"} ${className}`}
      >
        {sigo ? <><Check size={18} aria-hidden /> Siguiendo</> : <><Plus size={18} aria-hidden /> Seguir</>}
      </button>
      {error && <span role="alert" className="text-[14px] text-error">{error}</span>}
    </>
  );
}

function hace(fecha: string): string {
  const m = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * Comentarios de UN set (no se mezclan con Meet Zone). El DJ dueño ve
 * "Responder" en cada comentario; la base no deja responder a nadie más.
 */
export function HojaComentarios({
  setId, titulo, abierta, onCerrar, soyDj = false, nombreDj, onTotal,
}: {
  setId: string | null; titulo: string; abierta: boolean; onCerrar: () => void;
  soyDj?: boolean; nombreDj?: string; onTotal?: (n: number) => void;
}) {
  const { user } = useAuth();
  const [lista, setLista] = useState<Comentario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [respondiendo, setRespondiendo] = useState<Comentario | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar(id: string) {
    setCargando(true);
    const r = await getComentarios(id);
    setLista(r.data); setError(r.error); setCargando(false);
    onTotal?.(r.data.length);
  }
  useEffect(() => {
    if (abierta && setId) void cargar(setId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, setId]);

  const raiz = lista.filter((c) => !c.respuesta_de);
  const respuestas = (id: string) => lista.filter((c) => c.respuesta_de === id);

  async function enviar() {
    if (!user || !setId || !texto.trim()) return;
    setEnviando(true);
    const e = await comentar(setId, user.id, texto, respondiendo?.id ?? null);
    setEnviando(false);
    if (e) { setError(e); return; }
    setTexto(""); setRespondiendo(null);
    await cargar(setId);
  }

  const Fila = ({ c, resp }: { c: Comentario; resp?: boolean }) => (
    <li className={`flex gap-3 ${resp ? "ml-8" : ""}`}>
      {resp && <CornerDownRight size={16} className="mt-1 shrink-0 text-tinta-suave" aria-hidden />}
      <div className="min-w-0 flex-1 rounded-2xl bg-fondo px-3 py-2">
        <p className="text-[14px] font-bold">
          <span className={c.es_dj ? "text-magenta" : ""}>{c.es_dj ? (nombreDj || "DJ") : (c.alias || "Tardícola")}</span>
          {c.es_dj && <span className="ml-1.5 rounded-full bg-magenta-50 px-2 py-0.5 text-[12px] text-magenta">DJ</span>}
          <span className="ml-2 font-normal text-tinta-suave">{hace(c.created_at)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-line break-words text-[15px]">{c.texto}</p>
        {/* Botones de 44 px de alto (WCAG 2.2, público 30+): con 36 se fallaba el toque. */}
        <div className="mt-1 flex gap-3">
          {soyDj && !resp && (
            <button type="button" onClick={() => setRespondiendo(c)} className="min-h-[44px] px-1 text-[14px] font-bold text-magenta">Responder</button>
          )}
          {(soyDj || c.autor === user?.id) && (
            <button type="button" onClick={async () => { const e = await borrarComentario(c.id); if (e) setError(e); else if (setId) await cargar(setId); }}
              className="inline-flex min-h-[44px] items-center gap-1 px-1 text-[14px] text-tinta-suave" aria-label="Borrar comentario">
              <Trash2 size={14} aria-hidden /> Borrar
            </button>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={`Comentarios · ${titulo}`}
      pie={user ? (
        <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="flex flex-col gap-2">
          {respondiendo && (
            <p className="flex items-center justify-between text-[14px] text-tinta-suave">
              Respondiendo a {respondiendo.alias || "Tardícola"}
              <button type="button" className="min-h-[44px] min-w-[44px] px-1 font-bold text-magenta" onClick={() => setRespondiendo(null)}>Cancelar</button>
            </p>
          )}
          <div className="flex gap-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000}
              placeholder={respondiendo ? "Escribe tu respuesta…" : "Escribe un comentario…"}
              aria-label="Comentario"
              className="min-h-tacto min-w-0 flex-1 rounded-full border border-linea bg-superficie px-4 text-[16px]" />
            <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar"
              className="grid h-12 w-12 place-items-center rounded-full bg-magenta text-white disabled:opacity-50">
              {enviando ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Send size={20} aria-hidden />}
            </button>
          </div>
        </form>
      ) : (
        <Link href={entrarYVolver(typeof window !== "undefined" ? window.location.pathname : "/djs")}
          className="flex min-h-tacto w-full items-center justify-center rounded-xl bg-magenta font-bold text-white">
          Entra para comentar
        </Link>
      )}
    >
      {error && <p role="alert" className="mb-3 rounded-xl bg-error-fondo p-3 text-[15px] text-error">{error}</p>}
      {cargando ? <p className="py-6 text-center text-tinta-suave">Cargando…</p>
        : raiz.length === 0 ? <p className="py-6 text-center text-[15px] text-tinta-suave">Aún no hay comentarios. ¡Sé el primero!</p>
        : (
          <ul className="flex flex-col gap-3">
            {raiz.map((c) => (
              <li key={c.id} className="list-none">
                <ul className="flex flex-col gap-2">
                  <Fila c={c} />
                  {respuestas(c.id).map((r) => <Fila key={r.id} c={r} resp />)}
                </ul>
              </li>
            ))}
          </ul>
        )}
    </Hoja>
  );
}
