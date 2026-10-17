"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Bookmark, Share2, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { AvatarDj } from "@/components/DjCard";
import { BotonPlay, BotonSeguir, HojaComentarios } from "@/components/musica/piezas";
import { useAuth } from "@/lib/useAuth";
import { getAdn } from "@/lib/tardicola";
import { entrarYVolver } from "@/lib/volver";
import { getFeed, gustarSetDetalle, guardarSetDetalle, portadaDe, type TarjetaFeed } from "@/lib/sets";
import { optimizable } from "@/lib/fotos";

const POR_PAGINA = 6;

/** Estilos del ADN ("electronica:afro house") → palabras que se comparan con los del DJ. */
function estilosDeAdn(musica: string[]): string[] {
  const s = new Set<string>();
  for (const m of musica) for (const p of m.split(":")) if (p.trim()) s.add(p.trim().toLowerCase());
  return [...s];
}

function fechaCorta(f: string | null): string {
  if (!f) return "";
  return new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Feed vertical de DJs, pantalla completa con scroll‑snap (vídeo 1:30‑1:45).
 * Para ti: afines a tu ADN musical y con evento próximo primero. Siguiendo:
 * solo los DJs que sigues. Nada suena hasta que se pulsa ▶.
 */
export default function FeedDjs() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [modo, setModo] = useState<"parati" | "siguiendo">("parati");
  const [estilos, setEstilos] = useState<string[] | null>(null);
  const [items, setItems] = useState<TarjetaFeed[]>([]);
  const [fin, setFin] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comentando, setComentando] = useState<TarjetaFeed | null>(null);
  const centinela = useRef<HTMLDivElement>(null);
  // Número de la última petición lanzada. Al cambiar de pestaña se lanza una
  // nueva aunque haya otra en curso: la vieja, al llegar, ve que ya no es la
  // última y se descarta. Antes un booleano "pidiendo" hacía que el reinicio
  // se saltara y luego llegaba la página de la pestaña anterior (listas
  // mezcladas y sin los primeros de la nueva).
  const peticion = useRef(0);
  // Solo para "cargar más": evita pedir dos veces la misma página mientras
  // el scroll sigue viendo el centinela. Un reinicio no lo respeta.
  const enVuelo = useRef(false);
  // ♥ / guardar con petición en curso (clave "tipo:dj"): un doble toque
  // lanzaba alta y baja a la vez y el contador acababa descuadrado.
  const marcando = useRef(new Set<string>());

  // ADN del usuario (si lo tiene). Sin sesión, sin ADN: orden general.
  useEffect(() => {
    if (loading) return;
    if (!user) { setEstilos([]); return; }
    getAdn(user.id).then((a) => setEstilos(estilosDeAdn(a?.musica ?? []))).catch(() => setEstilos([]));
  }, [user, loading]);

  const cargar = useCallback(async (reiniciar: boolean) => {
    if (estilos === null) return;
    if (!reiniciar && enVuelo.current) return;
    const yo = ++peticion.current;
    enVuelo.current = true; setCargando(true);
    const desde = reiniciar ? 0 : items.length;
    const r = await getFeed(modo === "siguiendo", estilos, desde, POR_PAGINA);
    if (yo !== peticion.current) return; // llegó tarde: hay otra más nueva
    enVuelo.current = false; setCargando(false);
    if (r.error) { setError(r.error); setFin(true); return; }
    setError(null);
    setItems((xs) => (reiniciar ? r.data : [...xs, ...r.data.filter((n) => !xs.some((x) => x.dj_id === n.dj_id))]));
    setFin(r.data.length < POR_PAGINA);
  }, [estilos, modo, items.length]);

  // Al cambiar de pestaña o tener el ADN: empezar de cero.
  useEffect(() => {
    if (estilos === null) return;
    if (modo === "siguiendo" && !user) {
      // Invalida lo que estuviera en camino para que no rellene esta pestaña.
      peticion.current++; enVuelo.current = false;
      setItems([]); setFin(true); setCargando(false); return;
    }
    setItems([]); setFin(false); setError(null);
    void cargar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, estilos, user]);

  // Paginación infinita: al ver la penúltima tarjeta, pide más.
  useEffect(() => {
    const el = centinela.current;
    if (!el || fin) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) void cargar(false); }, { rootMargin: "200%" });
    io.observe(el);
    return () => io.disconnect();
  }, [cargar, fin, items.length]);

  function cambiar(dj: string, cambios: Partial<TarjetaFeed>) {
    setItems((xs) => xs.map((x) => (x.dj_id === dj ? { ...x, ...cambios } : x)));
  }

  async function marcar(t: TarjetaFeed, tipo: "like" | "guardar") {
    if (!user) { router.push(entrarYVolver("/djs")); return; }
    if (!t.set_id) return;
    const clave = `${tipo}:${t.dj_id}`;
    if (marcando.current.has(clave)) return; // ya hay una en vuelo: se ignora el segundo toque
    marcando.current.add(clave);
    try {
      if (tipo === "like") {
        const v = !t.me_gusta;
        cambiar(t.dj_id, { me_gusta: v, set_likes: Math.max(0, (t.set_likes ?? 0) + (v ? 1 : -1)) });
        const r = await gustarSetDetalle(t.set_id, user.id, v);
        // Fallo: todo como estaba. "Ya estaba así": el ♥ queda, pero el
        // contador de la base no se movió, así que tampoco el de la tarjeta.
        if (r.error) { cambiar(t.dj_id, { me_gusta: t.me_gusta, set_likes: t.set_likes }); alert(r.error); }
        else if (!r.cambio) cambiar(t.dj_id, { me_gusta: v, set_likes: t.set_likes });
      } else {
        const v = !t.guardado;
        cambiar(t.dj_id, { guardado: v });
        const r = await guardarSetDetalle(t.set_id, user.id, v);
        if (r.error) { cambiar(t.dj_id, { guardado: t.guardado }); alert(r.error); }
      }
    } finally {
      marcando.current.delete(clave);
    }
  }

  async function compartir(t: TarjetaFeed) {
    const url = `${window.location.origin}/djs/${t.dj_id}`;
    try {
      if (navigator.share) await navigator.share({ title: t.nombre, text: `Escucha a ${t.nombre} en TardeosClub`, url });
      else { await navigator.clipboard.writeText(url); alert("Enlace copiado"); }
    } catch { /* cancelado */ }
  }

  return (
    <>
    <main className="fixed inset-x-0 top-0 bottom-[var(--alto-barra-inferior,calc(64px+env(safe-area-inset-bottom)))] z-[60] bg-black text-white md:bottom-0">
      {/* Pestañas sobre el feed */}
      <div role="tablist" aria-label="Feed de DJs" className="absolute inset-x-0 top-0 z-20 flex justify-center gap-6 bg-gradient-to-b from-black/60 to-transparent pb-6 pt-[max(12px,env(safe-area-inset-top))]">
        {([["parati", "Para ti"], ["siguiendo", "Siguiendo"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={modo === k} type="button" onClick={() => setModo(k)}
            className={`min-h-[44px] px-2 text-[17px] font-bold ${modo === k ? "text-white underline decoration-magenta decoration-[3px] underline-offset-8" : "text-white/70"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="mx-auto h-full max-w-md snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]">
        {items.map((t, i) => {
          // Imagen propia de la tarjeta (portada del set, flyer o banner). Si solo
          // hay avatar (400x400), estirarlo a pantalla completa daba una cara
          // enorme y pixelada: va difuminado de fondo y nítido en un círculo.
          const propia = portadaDe({ portada: t.set_portada, url: t.set_url }) || t.evento_flyer || t.banner_url;
          const fondo = propia || t.avatar_url;
          const sesion = [t.set_titulo ?? t.evento_titulo, (t.set_estilos?.length ? t.set_estilos : t.estilos ?? []).slice(0, 2).join(" / ")].filter(Boolean).join(" · ");
          return (
            <article key={t.dj_id} className="relative h-full w-full snap-start snap-always overflow-hidden" aria-label={t.nombre}>
              {propia ? (
                <Image src={propia} alt="" fill sizes="(max-width: 448px) 100vw, 448px" priority={i < 2} unoptimized={!optimizable(propia)} className="object-cover" />
              ) : t.avatar_url ? (
                <>
                  {/* Fondo: el avatar pequeñito (64 px) muy difuminado y oscurecido;
                      con blur fuerte no hace falta más resolución. */}
                  <Image src={t.avatar_url} alt="" fill sizes="64px" priority={i < 2} unoptimized={!optimizable(t.avatar_url)}
                    className="scale-125 object-cover blur-2xl brightness-[0.55]" />
                  <div className="absolute left-1/2 top-[16%] h-40 w-40 -translate-x-1/2 overflow-hidden rounded-full shadow-2xl ring-4 ring-white/80">
                    <Image src={t.avatar_url} alt="" fill sizes="160px" priority={i < 2} unoptimized={!optimizable(t.avatar_url)} className="object-cover" />
                  </div>
                </>
              ) : <div className="absolute inset-0 bg-[linear-gradient(160deg,#2B0A26,#930E72_60%,#D61AA8)]" />}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

              {t.set_id && t.set_url && (
                <div className="absolute inset-0 grid place-items-center">
                  <BotonPlay grande set={{ id: t.set_id, titulo: t.set_titulo ?? "Set", url: t.set_url, plataforma: t.set_plataforma, portada: fondo }}
                    autor={t.nombre} className="border-[3px] border-white bg-black/30 text-white backdrop-blur" />
                </div>
              )}

              {/* Acciones laterales: ♥, comentar, guardar set, compartir */}
              <div className="absolute bottom-48 right-2 z-10 flex flex-col items-center gap-3">
                {t.set_id && (
                  <>
                    <Accion etiqueta="Me gusta" activo={t.me_gusta} onClick={() => void marcar(t, "like")} cifra={t.set_likes ?? 0}>
                      <Heart size={28} className={t.me_gusta ? "fill-magenta text-magenta" : ""} aria-hidden />
                    </Accion>
                    <Accion etiqueta="Comentar" onClick={() => setComentando(t)} cifra={t.set_comentarios ?? 0}>
                      <MessageCircle size={28} aria-hidden />
                    </Accion>
                    <Accion etiqueta="Guardar set" activo={t.guardado} onClick={() => void marcar(t, "guardar")}>
                      <Bookmark size={28} className={t.guardado ? "fill-white" : ""} aria-hidden />
                    </Accion>
                  </>
                )}
                <Accion etiqueta="Compartir" onClick={() => void compartir(t)}>
                  <Share2 size={28} aria-hidden />
                </Accion>
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 px-4 pb-[calc(16px+var(--alto-mini,0px))]">
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white">
                    <AvatarDj nombre={t.nombre} url={t.avatar_url} sizes="44px" textoClase="text-base" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-[20px] font-bold">{t.nombre}</p>
                  <BotonSeguir djId={t.dj_id} inicial={t.siguiendo} oscuro
                    onCambio={(v) => cambiar(t.dj_id, { siguiendo: v })} />
                </div>
                {sesion && <p className="text-[15px] text-white/90">{sesion}</p>}
                {t.evento_id && (
                  <Link href={`/tardeos/${t.evento_id}`} className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-full bg-white/15 px-3 text-[15px] font-semibold backdrop-blur">
                    <CalendarDays size={18} aria-hidden /> {fechaCorta(t.evento_fecha)} · {t.evento_local ?? t.evento_titulo}
                  </Link>
                )}
                <Link href={`/djs/${t.dj_id}`} className="flex min-h-tacto items-center justify-center gap-1 rounded-xl border border-white/80 text-[16px] font-bold">
                  Ver perfil <ChevronRight size={18} aria-hidden />
                </Link>
              </div>
            </article>
          );
        })}

        {/* Estados: cargando / vacío / error, también a pantalla completa. */}
        {(items.length === 0 || cargando || error) && (
          <div className="grid h-full snap-start place-items-center px-8 text-center">
            {cargando ? <Loader2 size={32} className="animate-spin" aria-label="Cargando" />
              : error ? <p className="text-[16px]">{error}</p>
              : modo === "siguiendo" && !user ? (
                <div>
                  <p className="text-[18px] font-bold">Entra para ver a los DJs que sigues</p>
                  <Link href={entrarYVolver("/djs")} className="mt-4 inline-flex min-h-tacto items-center rounded-xl bg-magenta px-6 font-bold">Entrar</Link>
                </div>
              ) : modo === "siguiendo" ? (
                <div>
                  <p className="text-[18px] font-bold">Aún no sigues a ningún DJ</p>
                  <button type="button" onClick={() => setModo("parati")} className="mt-4 inline-flex min-h-tacto items-center rounded-xl bg-magenta px-6 font-bold">Descubrir DJs</button>
                </div>
              ) : <p className="text-[16px]">Todavía no hay sets ni fechas que enseñar.</p>}
          </div>
        )}
        <div ref={centinela} aria-hidden className="h-px" />
      </div>
    </main>

    {/* Fuera del <main> fijo: si no, quedaría por debajo de la barra de abajo. */}
    <HojaComentarios
        setId={comentando?.set_id ?? null} titulo={comentando?.set_titulo ?? ""} abierta={!!comentando}
        onCerrar={() => setComentando(null)} nombreDj={comentando?.nombre}
        onTotal={(n) => comentando && cambiar(comentando.dj_id, { set_comentarios: n })}
      />
    </>
  );
}

function Accion({ children, etiqueta, onClick, cifra, activo }: { children: React.ReactNode; etiqueta: string; onClick: () => void; cifra?: number; activo?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={etiqueta} aria-pressed={activo}
      className="flex min-h-[52px] min-w-[52px] flex-col items-center justify-center gap-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
      {children}
      {cifra !== undefined && <span className="text-[13px] font-bold">{cifra}</span>}
    </button>
  );
}
