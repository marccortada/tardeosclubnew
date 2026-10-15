"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Play, Pause, Loader2, ArrowUpRight, Headphones, Send } from "lucide-react";
import CompartirBtn from "@/components/CompartirBtn";
import { useReproductor } from "@/components/musica/Reproductor";
import { BotonPlay } from "@/components/musica/piezas";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { entrarYVolver } from "@/lib/volver";
import { faltaLote, MENSAJE_FALTA_LOTE, ESTADOS_NEXO, getSetsDeDj, type EnvioNexo, type SetDj, type Plataforma } from "@/lib/sets";

const WEB_NEXO = "https://nexoradio.es/";
type Pestana = "escuchar" | "programacion" | "enviar";
type Sesion = { id: string; titulo: string; url: string; descripcion: string | null; dj_id: string; dj_nombre: string; dj_avatar: string | null; portada: string | null; plataforma: Plataforma };
type Franja = { id: string; dia_semana: number | null; hora: string; titulo: string; detalle: string | null };
const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/**
 * Nexo Radio dentro de la app (dossier pág. 8, vídeo 0:25‑0:35).
 * Identidad propia de Nexo (cabecera negra con su logo). El play es
 * voluntario y usa el reproductor global: elegir Nexo detiene lo demás.
 * "En directo" SOLO si hay stream real configurado y está sonando.
 */
export default function NexoRadioPagina({ stream }: { stream: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const inicial = params.get("pestana");
  const [pestana, setPestana] = useState<Pestana>(inicial === "programacion" || inicial === "enviar" ? inicial : "escuchar");
  const { actual, sonando, cargando, reproducir, alternar } = useReproductor();
  const esNexo = actual?.tipo === "nexo";

  function playNexo() {
    if (!stream) { window.open(WEB_NEXO, "_blank", "noopener,noreferrer"); return; }
    if (esNexo) { alternar(); return; }
    reproducir({ id: "nexo-directo", titulo: "Nexo Radio", autor: "El ritmo de tu tarde", url: stream, portada: "/branding/nexo-radio.png", tipo: "nexo", plataforma: "audio" });
  }

  function cambiar(p: Pestana) {
    setPestana(p);
    router.replace(p === "escuchar" ? "/nexo" : `/nexo?pestana=${p}`, { scroll: false });
  }

  return (
    <main className="mx-auto max-w-2xl bg-fondo pb-8">
      <div className="flex items-center gap-2 bg-superficie px-2 py-1">
        <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push("/"))} aria-label="Volver"
          className="grid h-12 w-12 place-items-center rounded-full hover:bg-fondo">
          <ArrowLeft size={22} aria-hidden />
        </button>
        <h1 className="flex-1 text-center text-[19px] font-bold">Nexo Radio</h1>
        <CompartirBtn titulo="Nexo Radio" texto="El ritmo de tu tarde" url="/nexo" className="grid h-12 w-12 place-items-center rounded-full hover:bg-fondo" />
      </div>

      <section className="mx-4 mt-2 flex flex-col items-center rounded-3xl bg-black px-6 pb-7 pt-6 text-center text-white">
        <Image src="/branding/nexo-radio.png" alt="Nexo Radio" width={120} height={120} className="h-28 w-28 rounded-xl object-contain" priority />
        <p className="mt-4 text-[24px] font-bold leading-tight">El ritmo de tu tarde</p>
        <p className="mt-1 text-[15px] text-white/70">Radio y comunidad musical</p>
        {stream && esNexo && sonando && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ff1f6b]/20 px-3 py-1 text-[14px] font-bold text-[#ff4f8b]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff1f6b]" aria-hidden /> En directo
          </p>
        )}
        <button type="button" onClick={playNexo}
          aria-label={!stream ? "Escuchar en nexoradio.es" : esNexo && sonando ? "Pausar Nexo Radio" : "Escuchar Nexo Radio"}
          className="mt-5 grid h-16 w-16 place-items-center rounded-full border-[3px] border-[#ff1f6b] text-[#ff1f6b] transition active:scale-95">
          {esNexo && cargando ? <Loader2 size={28} className="animate-spin" aria-hidden />
            : esNexo && sonando ? <Pause size={28} fill="currentColor" aria-hidden />
            : <Play size={28} fill="currentColor" className="translate-x-[2px]" aria-hidden />}
        </button>
        {!stream && <p className="mt-3 text-[14px] text-white/70">Se abre la web de Nexo Radio</p>}
      </section>

      <div role="tablist" aria-label="Nexo Radio" className="mx-4 mt-4 grid grid-cols-3 gap-1 rounded-xl bg-marfil-100 p-1">
        {([["escuchar", "Escuchar"], ["programacion", "Programación"], ["enviar", "Enviar sesión"]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={pestana === k} onClick={() => cambiar(k)}
            className={`min-h-[44px] rounded-lg text-[15px] font-bold ${pestana === k ? "bg-magenta text-white" : "text-tinta"}`}>{l}</button>
        ))}
      </div>

      <div className="px-4 pt-5">
        {pestana === "escuchar" && <Escuchar />}
        {pestana === "programacion" && <Programacion />}
        {pestana === "enviar" && <Enviar />}
      </div>
    </main>
  );
}

function Escuchar() {
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("nexo_sesiones", { p_limite: 20 }).then(({ data, error }) => {
      if (error) { setError(faltaLote(error) ? MENSAJE_FALTA_LOTE : error.message); setSesiones([]); return; }
      setSesiones((data ?? []) as Sesion[]);
    });
  }, []);
  return (
    <section>
      <h2 className="text-[20px] font-bold">Descubre sesiones</h2>
      {error && <p className="mt-3 rounded-xl bg-aviso-fondo p-3 text-[15px] text-aviso">{error}</p>}
      {sesiones === null ? <p className="mt-3 text-tinta-suave">Cargando…</p>
        : sesiones.length === 0 && !error ? <p className="mt-3 text-[15px] text-tinta-suave">Pronto verás aquí las sesiones que selecciona Nexo.</p>
        : (
          <ul className="mt-3 flex flex-col gap-2">
            {sesiones.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-linea bg-superficie p-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-tinta">
                  {(s.portada || s.dj_avatar) && <Image src={(s.portada || s.dj_avatar)!} alt="" fill sizes="48px" unoptimized className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold">{s.titulo}</p>
                  <Link href={`/djs/${s.dj_id}`} className="truncate text-[14px] text-tinta-suave underline-offset-2 hover:underline">{s.dj_nombre}</Link>
                </div>
                <BotonPlay set={{ id: `nexo-${s.id}`, titulo: s.titulo, url: s.url, plataforma: s.plataforma, portada: s.portada || s.dj_avatar }}
                  autor={s.dj_nombre} className="border-2 border-magenta text-magenta" />
              </li>
            ))}
          </ul>
        )}
      <a href={WEB_NEXO} target="_blank" rel="noopener noreferrer"
        className="mt-4 flex min-h-tacto items-center gap-3 border-t border-linea pt-3 text-[16px] font-bold">
        <Headphones size={20} aria-hidden /> <span className="flex-1">Ir a Nexo Radio</span> <ArrowUpRight size={18} aria-hidden />
      </a>
    </section>
  );
}

function Programacion() {
  const [filas, setFilas] = useState<Franja[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("nexo_programacion").select("id,dia_semana,hora,titulo,detalle")
      .order("dia_semana", { nullsFirst: true }).order("hora").order("orden")
      .then(({ data, error }) => {
        if (error) { setError(faltaLote(error) ? MENSAJE_FALTA_LOTE : error.message); setFilas([]); return; }
        setFilas((data ?? []) as Franja[]);
      });
  }, []);
  if (filas === null) return <p className="text-tinta-suave">Cargando…</p>;
  if (error) return <p className="rounded-xl bg-aviso-fondo p-3 text-[15px] text-aviso">{error}</p>;
  if (!filas.length) return <p className="text-[15px] text-tinta-suave">La programación se publicará pronto.</p>;
  return (
    <ul className="divide-y divide-linea">
      {filas.map((f) => (
        <li key={f.id} className="flex min-h-[56px] items-center gap-3 py-2">
          <Headphones size={20} className="shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold">{f.titulo}</p>
            {(f.detalle || f.dia_semana) && <p className="text-[14px] text-tinta-suave">{[f.dia_semana ? DIAS[f.dia_semana] : null, f.detalle].filter(Boolean).join(" · ")}</p>}
          </div>
          <span className="text-[15px] text-tinta-suave">{f.hora.slice(0, 5)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Enviar sesión: solo DJs. Enviar no garantiza emisión ni fecha (dossier). */
export function Enviar() {
  const { user, loading } = useAuth();
  const [djId, setDjId] = useState<string | null | undefined>(undefined);
  const [sets, setSets] = useState<SetDj[]>([]);
  const [envios, setEnvios] = useState<EnvioNexo[]>([]);
  const [setId, setSetId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function cargarEnvios(id: string) {
    const { data, error } = await supabase.from("nexo_envios")
      .select("id,dj_id,set_id,titulo,url,descripcion,estado,nota_nexo,created_at,revisado_en")
      .eq("dj_id", id).order("created_at", { ascending: false }).limit(20);
    if (error) { setMsg({ ok: false, t: faltaLote(error) ? MENSAJE_FALTA_LOTE : error.message }); return; }
    setEnvios((data ?? []) as EnvioNexo[]);
  }

  useEffect(() => {
    if (loading) return;
    if (!user) { setDjId(null); return; }
    supabase.from("djs").select("id").eq("profile_id", user.id).order("created_at").limit(1).maybeSingle()
      .then(({ data }) => {
        const id = (data as { id: string } | null)?.id ?? null;
        setDjId(id);
        if (id) { void getSetsDeDj(id).then((r) => setSets(r.data)); void cargarEnvios(id); }
      });
  }, [user, loading]);

  if (djId === undefined) return <p className="text-tinta-suave">Cargando…</p>;
  if (!djId) {
    return (
      <div className="rounded-2xl border border-linea bg-superficie p-5">
        <h2 className="text-[20px] font-bold">Comparte tu sesión</h2>
        <p className="mt-2 text-[16px] leading-relaxed">
          Los DJs de TardeosClub pueden enviar sus sesiones al equipo de Nexo Radio para que las escuche.
          Si eres DJ, entra con tu cuenta profesional para enviar la tuya.
        </p>
        {!user && <Link href={entrarYVolver("/nexo?pestana=enviar")} className="mt-4 inline-flex min-h-tacto items-center rounded-xl bg-magenta px-6 font-bold text-white">Entrar</Link>}
      </div>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!djId) return;
    if (!/^https?:\/\//.test(url.trim())) { setMsg({ ok: false, t: "Pega el enlace completo de la sesión (https://…)." }); return; }
    setEnviando(true); setMsg(null);
    const { error } = await supabase.from("nexo_envios").insert({
      dj_id: djId, set_id: setId || null, titulo: titulo.trim(), url: url.trim(), descripcion: descripcion.trim() || null,
    });
    setEnviando(false);
    if (error) { setMsg({ ok: false, t: faltaLote(error) ? MENSAJE_FALTA_LOTE : error.message }); return; }
    setMsg({ ok: true, t: "Sesión enviada. El equipo de Nexo la revisará; enviar no garantiza emisión ni fecha." });
    setTitulo(""); setUrl(""); setDescripcion(""); setSetId("");
    void cargarEnvios(djId);
  }

  const campo = "min-h-tacto w-full rounded-xl border border-linea bg-superficie px-4 text-[16px]";
  return (
    <div>
      <h2 className="text-[20px] font-bold">Comparte tu sesión</h2>
      <p className="mt-1 text-[15px] text-tinta-suave">Envíala para revisión al equipo de Nexo.</p>
      <form onSubmit={enviar} className="mt-4 flex flex-col gap-3">
        {sets.length > 0 && (
          <label className="flex flex-col gap-1 text-[15px] font-semibold">
            Elegir uno de tus sets (opcional)
            <select value={setId} className={campo} onChange={(e) => {
              const s = sets.find((x) => x.id === e.target.value);
              setSetId(e.target.value);
              if (s) { setTitulo(s.titulo); setUrl(s.url); }
            }}>
              <option value="">— Otro enlace —</option>
              {sets.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
            </select>
          </label>
        )}
        <input required maxLength={140} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título · p. ej. Sunset Session" aria-label="Título" className={campo} />
        <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enlace de la sesión" aria-label="Enlace de la sesión" className={campo} />
        <textarea maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Estilos, duración, dónde se grabó…" aria-label="Descripción" rows={3}
          className="w-full rounded-xl border border-linea bg-superficie px-4 py-3 text-[16px]" />
        <button type="submit" disabled={enviando} className="inline-flex min-h-tacto items-center justify-center gap-2 rounded-xl bg-magenta font-bold text-white disabled:opacity-50">
          {enviando ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Send size={20} aria-hidden />} Enviar sesión
        </button>
        {msg && <p role="status" className={`rounded-xl p-3 text-[15px] ${msg.ok ? "bg-ok-fondo text-ok" : "bg-error-fondo text-error"}`}>{msg.t}</p>}
      </form>

      {envios.length > 0 && (
        <section className="mt-6">
          <h3 className="text-[17px] font-bold">Mis envíos</h3>
          <ul className="mt-2 divide-y divide-linea">
            {envios.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[16px] font-bold">{e.titulo}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${
                    e.estado === "aceptado" || e.estado === "emitido" ? "bg-ok-fondo text-ok" : e.estado === "rechazado" ? "bg-marfil-100 text-tinta-suave" : "bg-aviso-fondo text-aviso"}`}>
                    {ESTADOS_NEXO[e.estado]}
                  </span>
                </div>
                <p className="text-[14px] text-tinta-suave">{new Date(e.created_at).toLocaleDateString("es-ES")}</p>
                {e.nota_nexo && <p className="mt-1 text-[15px]">Nexo: {e.nota_nexo}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
