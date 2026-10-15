"use client";
import { entrarYVolver } from "@/lib/volver";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard, CalendarDays, CalendarPlus, LineChart, Store, Megaphone,
  Star, LifeBuoy, ShieldCheck, Loader2, LogIn, ArrowLeft,
} from "lucide-react";
import PanelShell, { type GrupoPanel, SeccionPanel } from "@/components/panel/PanelShell";
import { claseBoton } from "@/components/Boton";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { getMisLocales, getLocalParaPanel } from "@/lib/tardeos";
import { planesActivos } from "@/lib/ajustes";

/**
 * El panel de "Soy un local o evento": la ficha se carga UNA vez aquí y la
 * comparten todas las secciones.
 *
 * Antes cada pantalla (/local, /local/editar, /local/crear) pedía su local por
 * su cuenta, cada una a su manera, y solo la primera ficha del usuario: quien
 * tenía un bar y además organizaba fuera como promotor no podía llegar nunca a
 * la segunda. Ahora hay selector, y el admin puede abrir cualquier ficha con
 * `?id=` (lo usa Administración → Locales para editar fichas ajenas).
 */

/** La fila de `locales` tal como la lee el panel (ver COLS_MI_LOCAL). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FichaLocal = Record<string, any> & { id: string; nombre: string; tipo?: string | null };

type Contexto = {
  user: User;
  esAdmin: boolean;
  /** La ficha que se está gestionando. Null solo para un admin sin ficha
   *  elegida (entra a crear o editar un tardeo de cualquiera). */
  ficha: FichaLocal | null;
  /** Las fichas propias del usuario. */
  fichas: FichaLocal[];
  /** El admin está mirando una ficha que no es suya. */
  ajena: boolean;
  esPromotor: boolean;
  /** `ajustes.planes_activos`. Mientras sea false nada se cobra. */
  planes: boolean;
  elegir: (id: string) => void;
  /** Mezcla cambios ya guardados en la ficha en memoria (tras editar). */
  actualizar: (cambios: Partial<FichaLocal>) => void;
  /** Un enlace del panel que conserva la ficha elegida al recargar. */
  enlace: (ruta: string) => string;
};

const Ctx = createContext<Contexto | null>(null);

export function usePanelLocal(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePanelLocal fuera de PanelLocal");
  return c;
}

/**
 * Para las secciones que solo se pintan con una ficha elegida (todas menos
 * crear y editar tardeo, que también usa el admin sin ficha propia).
 */
export function useFicha(): Contexto & { ficha: FichaLocal } {
  const c = usePanelLocal();
  if (!c.ficha) throw new Error("Sección del panel sin ficha elegida");
  return c as Contexto & { ficha: FichaLocal };
}

/** Recordar la ficha elegida es solo comodidad: si el navegador no deja, no pasa nada. */
const CLAVE = "tc-panel-local";
const leerElegida = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardarElegida = (id: string) => { try { localStorage.setItem(CLAVE, id); } catch { /* sin almacenamiento */ } };
const idDeUrl = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("id"));

/** Rutas que un admin sin ficha propia necesita igualmente (llega desde /admin). */
const rutaDeAdmin = (p: string) => p === "/local/crear" || /^\/local\/tardeos\/[^/]+\/editar$/.test(p);

export default function PanelLocal({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [fichas, setFichas] = useState<FichaLocal[]>([]);
  const [ficha, setFicha] = useState<FichaLocal | null>(null);
  const [planes, setPlanes] = useState(false);

  // Carga inicial: perfil, fichas propias y ajustes, en paralelo.
  useEffect(() => {
    if (loading) return;
    if (!user) { setCargando(false); return; }
    let vivo = true;
    (async () => {
      setCargando(true);
      const [perfil, mias, reglas] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
        getMisLocales(user.id),
        planesActivos().catch(() => false),
      ]);
      if (!vivo) return;
      const admin = !!perfil.data?.is_admin;
      setEsAdmin(admin);
      setFichas(mias.fichas as FichaLocal[]);
      setPlanes(reglas);
      setError(mias.error);

      // Cuál se abre: la de la URL, la última elegida o la primera.
      const pedida = idDeUrl();
      let elegida: FichaLocal | null = null;
      if (pedida) {
        elegida = (mias.fichas as FichaLocal[]).find((f) => f.id === pedida) ?? null;
        // Una ficha que no es suya solo la abre un admin (y RLS lo respalda).
        if (!elegida && admin) elegida = (await getLocalParaPanel(pedida)) as FichaLocal | null;
      }
      if (!elegida) {
        const recordada = leerElegida();
        elegida = (mias.fichas as FichaLocal[]).find((f) => f.id === recordada) ?? (mias.fichas[0] as FichaLocal) ?? null;
      }
      if (!vivo) return;
      setFicha(elegida);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [user, loading]);

  // Si se navega dentro del panel a un enlace con otro ?id (p. ej. desde un
  // aviso), se cambia de ficha sin recargar la página.
  useEffect(() => {
    if (cargando || !ficha) return;
    const pedida = idDeUrl();
    if (!pedida || pedida === ficha.id) return;
    const propia = fichas.find((f) => f.id === pedida);
    if (propia) { setFicha(propia); return; }
    if (esAdmin) getLocalParaPanel(pedida).then((f) => f && setFicha(f as FichaLocal));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const ajena = !!ficha && !fichas.some((f) => f.id === ficha.id);

  const elegir = useCallback((id: string) => {
    const f = fichas.find((x) => x.id === id);
    if (!f) return;
    setFicha(f);
    guardarElegida(id);
    // Se quita el ?id viejo de la barra: si no, al recargar volvería a la otra.
    router.replace(pathname);
  }, [fichas, pathname, router]);

  const actualizar = useCallback((cambios: Partial<FichaLocal>) => {
    setFicha((f) => (f ? { ...f, ...cambios } : f));
    setFichas((lista) => lista.map((f) => (ficha && f.id === ficha.id ? { ...f, ...cambios } : f)));
  }, [ficha]);

  // El ?id solo hace falta cuando no es obvio qué ficha es: una ajena (admin)
  // o cuando el usuario tiene varias. Con una sola, las URLs quedan limpias.
  const enlace = useCallback((ruta: string) => {
    if (!ficha || (!ajena && fichas.length < 2)) return ruta;
    return `${ruta}${ruta.includes("?") ? "&" : "?"}id=${ficha.id}`;
  }, [ficha, ajena, fichas.length]);

  const valor = useMemo<Contexto | null>(() => (user ? {
    user, esAdmin, ficha, fichas, ajena, planes,
    esPromotor: ficha?.tipo === "promotor",
    elegir, actualizar, enlace,
  } : null), [user, esAdmin, ficha, fichas, ajena, planes, elegir, actualizar, enlace]);

  // ---------- Estados previos al panel ----------
  if (loading || (user && cargando)) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-2 bg-marfil text-[15px] text-tinta-suave">
        <Loader2 className="animate-spin" size={20} aria-hidden /> Cargando tu panel…
      </main>
    );
  }

  if (!user || !valor) {
    return (
      <Aviso
        icono={<LogIn size={30} aria-hidden />}
        titulo="Entra para gestionar tu local"
        texto="Tu panel de local o de eventos está en tu cuenta. Entra con tu email; luego lo tienes en tu perfil, en «Mi local»."
        accion={<Link href={entrarYVolver(pathname)} className={claseBoton("primario", "normal", true)}>Entrar</Link>}
      />
    );
  }

  // Sin ficha y sin ser admin: lo único que hay que hacer es crearla. Un fallo
  // de lectura NO se trata como "no tienes local": invitaría a crear otra.
  if (!ficha && !esAdmin) {
    return error ? (
      <Aviso
        icono={<Store size={30} aria-hidden />}
        titulo="No hemos podido cargar tu ficha"
        texto="Puede ser la conexión. Vuelve a intentarlo en un momento; tus datos siguen guardados."
        accion={<button onClick={() => window.location.reload()} className={claseBoton("primario", "normal", true)}>Reintentar</button>}
      />
    ) : (
      <Aviso
        icono={<Store size={30} aria-hidden />}
        titulo="Aún no tienes local ni eventos"
        texto="Crea la ficha de tu local (o de tu marca de eventos) y empieza a publicar tardeos. Es gratis."
        accion={<Link href="/unirse?rol=local" className={claseBoton("primario", "normal", true)}>Crear mi local</Link>}
      />
    );
  }

  const tipo = ficha?.tipo === "promotor" ? "promotor" : "local";
  // Seis entradas como mucho (antes eran quince sueltas): cada una agrupa sus
  // pantallas, que salen como pestañas arriba de la página (SubSecciones).
  // Lo de pago (Suscripción, Coins) va junto en «Promoción» y marcado
  // «Próximamente» mientras los cobros sigan apagados (PayPal, más adelante).
  const grupos: GrupoPanel[] = ficha ? [
    {
      items: [
        { href: enlace("/local"), label: "Inicio", icon: LayoutDashboard, exacto: true },
        {
          href: enlace("/local/tardeos"), label: tipo === "promotor" ? "Mis eventos" : "Mis tardeos", icon: CalendarDays,
          hijas: [
            { href: enlace("/local/tardeos"), label: "Todos" },
            { href: enlace("/local/crear"), label: "Crear tardeo" },
            { href: enlace("/local/apuntados"), label: "Apuntados" },
            { href: enlace("/local/solicitudes"), label: "Solicitudes de DJs" },
          ],
        },
        {
          href: enlace("/local/editar"), label: tipo === "promotor" ? "Mi marca" : "Mi local", icon: tipo === "promotor" ? Megaphone : Store,
          hijas: [
            { href: enlace("/local/editar"), label: "Datos" },
            { href: enlace("/local/fotos"), label: "Fotos" },
            { href: enlace("/local/resenas"), label: "Reseñas" },
            { href: enlace("/local/qr"), label: "Código QR" },
            // Quien tiene un bar y además organiza fuera necesita dos fichas: una
            // de local y otra de eventos. Va a una pantalla del panel y no a
            // /unirse, que a quien ya tiene ficha le manda de vuelta aquí.
            ...(ajena ? [] : [{ href: "/local/nueva-ficha", label: "Añadir otra ficha" }]),
          ],
        },
        { href: enlace("/local/estadisticas"), label: "Estadísticas", icon: LineChart },
        {
          href: enlace("/local/promocionar"), label: "Promoción", icon: Star,
          hijas: [
            { href: enlace("/local/promocionar"), label: "Destacar" },
            { href: enlace("/local/suscripcion"), label: "Suscripción", nota: planes ? undefined : "Próximamente" },
            { href: enlace("/local/coins"), label: "Coins", nota: "Próximamente" },
          ],
        },
        { href: enlace("/local/ayuda"), label: "Ayuda", icon: LifeBuoy },
      ],
    },
    ...(esAdmin ? [{ titulo: "Administración", items: [{ href: "/admin", label: "Volver al admin", icon: ShieldCheck }] }] : []),
  ] : [
    // Admin sin ficha elegida: viene de /admin a crear o editar un tardeo.
    {
      items: [
        { href: "/local/crear", label: "Crear tardeo", icon: CalendarPlus },
        { href: "/admin/locales", label: "Elegir un local", icon: Store },
        { href: "/admin", label: "Volver al admin", icon: ShieldCheck },
      ],
    },
  ];

  const cabecera = ajena ? (
    <div className="rounded-lg bg-aviso-fondo px-3 py-2 text-[13px] font-semibold text-aviso">
      Estás viendo una ficha ajena como administrador.
      <Link href="/admin/locales" className="mt-1 flex items-center gap-1 font-bold underline underline-offset-2">
        <ArrowLeft size={14} aria-hidden /> Volver a Locales
      </Link>
    </div>
  ) : fichas.length > 1 && ficha ? (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wider text-tinta-suave">Gestionando</span>
      <select
        value={ficha.id}
        onChange={(e) => elegir(e.target.value)}
        className="min-h-[44px] w-full rounded-lg border border-linea-fuerte bg-white px-3 text-[15px] font-semibold outline-none focus:border-magenta focus:ring-4 focus:ring-magenta/15"
      >
        {fichas.map((f) => (
          <option key={f.id} value={f.id}>{f.nombre}{f.tipo === "promotor" ? " (eventos)" : ""}</option>
        ))}
      </select>
    </label>
  ) : null;

  return (
    <Ctx.Provider value={valor}>
      <PanelShell
        rol={!ficha ? "Administración" : tipo === "promotor" ? "Mis eventos" : "Mi local"}
        nombre={ficha?.nombre ?? "Sin local elegido"}
        grupos={grupos}
        cabecera={cabecera}
      >
        {ficha || rutaDeAdmin(pathname) ? children : (
          <SeccionPanel titulo="Elige un local" ancho="estrecho">
            <div className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
              <p className="text-[15px] text-tinta-suave">
                Eres administrador y no tienes una ficha propia. Abre la de cualquier local desde
                Administración → Locales (botón Editar) y la verás aquí con todas sus secciones.
              </p>
              <Link href="/admin/locales" className={claseBoton("primario", "normal", false, "mt-4")}>Ir a Locales</Link>
            </div>
          </SeccionPanel>
        )}
      </PanelShell>
    </Ctx.Provider>
  );
}

/** Pantalla suelta (sin barra lateral) para los casos en que aún no hay panel. */
function Aviso({ icono, titulo, texto, accion }: { icono: ReactNode; titulo: string; texto: string; accion: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-marfil px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-linea bg-white p-6 text-center shadow-tarjeta md:p-8">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-magenta-50 text-magenta">{icono}</span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-2 text-[15px] text-tinta-suave">{texto}</p>
        <div className="mt-6 flex flex-col gap-2">
          {accion}
          <Link href="/" className={claseBoton("contorno", "normal", true)}>Volver a la web</Link>
        </div>
      </div>
    </main>
  );
}
