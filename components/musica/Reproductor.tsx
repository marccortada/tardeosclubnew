"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- APIs de widget de terceros (YouTube, SoundCloud, Mixcloud) sin tipos */

import Image from "next/image";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pause, Play, X, Loader2, Radio } from "lucide-react";
import { ocultaBarraInferior } from "@/lib/rutasPanel";
import { plataformaDe, type Plataforma } from "@/lib/sets";

/**
 * Reproductor persistente (dossier 2.0, pág. 7):
 * - Nunca suena solo: solo arranca con `reproducir()`, que llama un botón.
 * - UNA fuente a la vez: reproducir otra cosa (incluido Nexo) destruye la
 *   anterior antes de crear la nueva.
 * - Sigue sonando al navegar: vive en app/layout.tsx, fuera de las páginas.
 * - SoundCloud, YouTube y Mixcloud se tocan con su widget oficial en un iframe
 *   oculto controlado por su API; un enlace de audio directo (mp3, stream de
 *   Nexo) va con <audio>, que es lo único con el que la pantalla bloqueada
 *   (MediaSession) funciona de verdad. Con iframes depende del navegador: el
 *   dossier pide no prometerlo.
 * - Lo que no se puede controlar (Spotify, enlaces raros) se abre fuera.
 *
 * Otros equipos: `useReproductor().reproducir({ id, titulo, autor, portada, url, tipo })`.
 * Mientras hay pista, <html> lleva `--alto-mini: 72px` (si no, 0px) para que
 * barras fijas propias puedan subirse: `bottom: calc(... + var(--alto-mini, 0px))`.
 */
export type Pista = {
  id: string; titulo: string; autor?: string; portada?: string | null; url: string;
  tipo: "set" | "nexo"; plataforma?: Plataforma;
};

type Ctx = {
  actual: Pista | null;
  sonando: boolean;
  cargando: boolean;
  reproducir: (p: Pista) => void;
  pausar: () => void;
  reanudar: () => void;
  alternar: () => void;
  cerrar: () => void;
};

const NOOP = () => {};
const ReproductorCtx = createContext<Ctx>({
  actual: null, sonando: false, cargando: false,
  reproducir: NOOP, pausar: NOOP, reanudar: NOOP, alternar: NOOP, cerrar: NOOP,
});

export function useReproductor() { return useContext(ReproductorCtx); }

type Motor = { play: () => void; pause: () => void; destruir: () => void };

const scripts = new Map<string, Promise<void>>();
function cargarScript(src: string, listo?: () => boolean): Promise<void> {
  if (listo?.()) return Promise.resolve();
  let p = scripts.get(src);
  if (!p) {
    p = new Promise<void>((ok, ko) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = () => ok(); s.onerror = () => { scripts.delete(src); ko(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(s);
    });
    scripts.set(src, p);
  }
  return p;
}

function cargarYouTube(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  return new Promise((ok, ko) => {
    const previo = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { previo?.(); ok(w.YT); };
    cargarScript("https://www.youtube.com/iframe_api").catch(ko);
  });
}

function idYouTube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function ReproductorProvider({ children }: { children: ReactNode }) {
  const [actual, setActual] = useState<Pista | null>(null);
  const [sonando, setSonando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const motor = useRef<Motor | null>(null);
  const gen = useRef(0);               // invalida callbacks de una pista anterior
  const caja = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const destruir = useCallback(() => {
    gen.current++;
    try { motor.current?.destruir(); } catch { /* el widget ya no existe */ }
    motor.current = null;
    if (caja.current) caja.current.innerHTML = "";
    setSonando(false);
    setCargando(false);
  }, []);

  const reproducir = useCallback((p: Pista) => {
    const plataforma = p.plataforma && p.plataforma !== "otra" ? p.plataforma : plataformaDe(p.url);
    if (actual?.id === p.id && actual.url === p.url && motor.current) { motor.current.play(); return; }
    // Lo que no podemos controlar se abre fuera, y no se queda "sonando" aquí.
    if (plataforma === "otra" && p.tipo !== "nexo") { window.open(p.url, "_blank", "noopener,noreferrer"); return; }

    destruir();
    const mia = ++gen.current;
    const vigente = () => gen.current === mia;
    const estado = (s: boolean) => { if (vigente()) { setSonando(s); if (s) setCargando(false); } };
    setActual({ ...p, plataforma });
    setCargando(true);
    const host = caja.current!;

    if (plataforma === "audio" || plataforma === "otra") {
      const a = audio.current ?? (audio.current = new Audio());
      a.preload = "none";
      a.src = p.url;
      a.onplaying = () => estado(true);
      a.onpause = () => estado(false);
      a.onended = () => estado(false);
      a.onerror = () => { if (vigente()) { setCargando(false); setSonando(false); } };
      motor.current = {
        play: () => { a.play().catch(() => estado(false)); },
        pause: () => a.pause(),
        destruir: () => { a.pause(); a.removeAttribute("src"); a.load(); },
      };
      motor.current.play();
      return;
    }

    if (plataforma === "youtube") {
      const vid = idYouTube(p.url);
      const div = document.createElement("div");
      host.appendChild(div);
      let player: any = null;
      motor.current = {
        play: () => player?.playVideo?.(),
        pause: () => player?.pauseVideo?.(),
        destruir: () => { try { player?.destroy?.(); } catch { /* nada */ } },
      };
      cargarYouTube().then((YT) => {
        if (!vigente()) return;
        player = new YT.Player(div, {
          width: 320, height: 180, videoId: vid ?? undefined,
          playerVars: { autoplay: 1, playsinline: 1, controls: 0 },
          events: {
            onReady: (e: any) => e.target.playVideo(),
            onStateChange: (e: any) => estado(e.data === 1),
          },
        });
      }).catch(() => vigente() && setCargando(false));
      return;
    }

    if (plataforma === "soundcloud") {
      const f = document.createElement("iframe");
      f.allow = "autoplay";
      f.width = "320"; f.height = "166";
      f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(p.url)}&auto_play=true&visual=false&show_comments=false`;
      host.appendChild(f);
      let w: any = null;
      motor.current = { play: () => w?.play(), pause: () => w?.pause(), destruir: () => { try { w?.unbind?.("play"); } catch { /* nada */ } } };
      cargarScript("https://w.soundcloud.com/player/api.js", () => !!(window as any).SC?.Widget).then(() => {
        if (!vigente()) return;
        const SC = (window as any).SC;
        w = SC.Widget(f);
        w.bind(SC.Widget.Events.READY, () => w.play());
        w.bind(SC.Widget.Events.PLAY, () => estado(true));
        w.bind(SC.Widget.Events.PAUSE, () => estado(false));
        w.bind(SC.Widget.Events.FINISH, () => estado(false));
      }).catch(() => vigente() && setCargando(false));
      return;
    }

    // Mixcloud
    const f = document.createElement("iframe");
    f.allow = "autoplay";
    f.width = "320"; f.height = "60";
    const feed = (() => { try { return new URL(p.url).pathname; } catch { return p.url; } })();
    f.src = `https://player-widget.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(feed)}&mini=1&hide_cover=1&autoplay=1`;
    host.appendChild(f);
    let w: any = null;
    motor.current = { play: () => w?.play(), pause: () => w?.pause(), destruir: NOOP };
    cargarScript("https://widget.mixcloud.com/media/js/widgetApi.js", () => !!(window as any).Mixcloud?.PlayerWidget).then(() => {
      if (!vigente()) return;
      w = (window as any).Mixcloud.PlayerWidget(f);
      w.ready.then(() => {
        if (!vigente()) return;
        w.events.play.on(() => estado(true));
        w.events.pause.on(() => estado(false));
        w.events.ended.on(() => estado(false));
        w.play();
      });
    }).catch(() => vigente() && setCargando(false));
  }, [actual, destruir]);

  const pausar = useCallback(() => motor.current?.pause(), []);
  const reanudar = useCallback(() => motor.current?.play(), []);
  const alternar = useCallback(() => (sonando ? motor.current?.pause() : motor.current?.play()), [sonando]);
  const cerrar = useCallback(() => { destruir(); setActual(null); }, [destruir]);

  // Si el navegador bloquea el arranque (pasa en iPhone con iframes), deja de
  // girar el "cargando": el usuario pulsa ▶ en el mini y ya es un gesto suyo.
  useEffect(() => {
    if (!cargando) return;
    const t = setTimeout(() => setCargando(false), 6000);
    return () => clearTimeout(t);
  }, [cargando]);

  // Pantalla bloqueada / controles del sistema, donde el navegador lo permita.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!actual) { ms.metadata = null; return; }
    try {
      ms.metadata = new MediaMetadata({
        title: actual.titulo, artist: actual.autor ?? "", album: actual.tipo === "nexo" ? "Nexo Radio" : "TardeosClub",
        artwork: actual.portada ? [{ src: actual.portada, sizes: "512x512" }] : [],
      });
      ms.playbackState = sonando ? "playing" : "paused";
      ms.setActionHandler("play", () => motor.current?.play());
      ms.setActionHandler("pause", () => motor.current?.pause());
      ms.setActionHandler("stop", () => cerrar());
    } catch { /* navegador sin soporte completo */ }
  }, [actual, sonando, cerrar]);

  useEffect(() => {
    document.documentElement.style.setProperty("--alto-mini", actual ? "72px" : "0px");
  }, [actual]);

  const valor = useMemo<Ctx>(() => ({ actual, sonando, cargando, reproducir, pausar, reanudar, alternar, cerrar }),
    [actual, sonando, cargando, reproducir, pausar, reanudar, alternar, cerrar]);

  return (
    <ReproductorCtx.Provider value={valor}>
      {children}
      {/* Widgets fuera de la vista: suenan, pero no ocupan pantalla. */}
      <div ref={caja} aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 h-[180px] w-[320px] overflow-hidden opacity-0" />
    </ReproductorCtx.Provider>
  );
}

/**
 * Mini‑reproductor fijo ENCIMA de la barra de abajo (no la tapa). Deja un
 * hueco al final de la página para no tapar el último botón. Sin pista, nada.
 */
export function MiniReproductor() {
  const { actual, sonando, cargando, alternar, cerrar } = useReproductor();
  const pathname = usePathname() ?? "";
  if (!actual) return null;
  const sinBarra = ocultaBarraInferior(pathname);
  return (
    <>
      <div aria-hidden className="h-20" />
      <div
        role="region" aria-label="Reproductor"
        className={`fixed inset-x-2 z-[999] mx-auto max-w-md md:inset-x-auto md:right-4 md:w-[380px] ${sinBarra ? "bottom-3" : "bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4"}`}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-linea bg-superficie/95 p-2 pr-1 shadow-elevada backdrop-blur">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-tinta">
            {actual.portada ? (
              <Image src={actual.portada} alt="" fill sizes="48px" className="object-cover" unoptimized />
            ) : (
              <span className="grid h-full w-full place-items-center text-white"><Radio size={22} aria-hidden /></span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight">{actual.titulo}</p>
            <p className="truncate text-[13px] text-tinta-suave">
              {actual.autor || (actual.tipo === "nexo" ? "Nexo Radio" : "")}
            </p>
          </div>
          <button
            type="button" onClick={alternar}
            aria-label={sonando ? "Pausar" : "Reproducir"}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-tinta transition hover:bg-fondo active:scale-95"
          >
            {cargando ? <Loader2 size={22} className="animate-spin" aria-hidden /> : sonando ? <Pause size={22} aria-hidden /> : <Play size={22} aria-hidden />}
          </button>
          <button
            type="button" onClick={cerrar} aria-label="Cerrar reproductor"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-tinta-suave transition hover:bg-fondo active:scale-95"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}
