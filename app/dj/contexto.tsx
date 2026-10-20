"use client";
import { entrarYVolver } from "@/lib/volver";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { LayoutDashboard, UserRound, CalendarDays, Disc3, Loader2, ShieldCheck, LifeBuoy, Headphones, MessageCircle } from "lucide-react";
import PanelShell, { type GrupoPanel } from "@/components/panel/PanelShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { esRutaPanel } from "@/lib/rutasPanel";
import { claseBoton } from "@/components/Boton";

/**
 * Panel "Soy DJ": la ficha se carga UNA vez aquí y la comparten todas las
 * secciones (Resumen, Mi perfil, Contenido, PressKit, Mis tardeos). Antes /dj
 * era una sola página que la pedía y la editaba toda junta.
 *
 * Con `?id=` y siendo admin se carga ESA ficha: el admin entra desde
 * /admin/djs para corregir el perfil de un DJ sin tener que ser él.
 */

export type Redes = { instagram?: string; soundcloud?: string; youtube?: string; whatsapp?: string; [k: string]: string | undefined };

export type FichaDj = {
  id: string;
  profile_id: string | null;
  nombre_artistico: string;
  bio: string | null;
  estilos: string[] | null;
  redes: Redes | null;
  verificado: boolean;
  reputacion_score: number | null;
  oculto: boolean;
  avatar_url: string | null;
  playlist_url: string | null;
  zonas: string[] | null;
  presskit_url?: string | null;
};

type Ctx = {
  dj: FichaDj;
  /** Mezcla cambios ya guardados en la base, para que todo el panel los vea. */
  actualizar: (cambios: Partial<FichaDj>) => void;
  /** El admin está editando la ficha de otro. */
  modoAdmin: boolean;
  /** La base aún no tiene `djs.presskit_url` (falta el lote 47). */
  sinColumnaPresskit: boolean;
  /** Enlace interno del panel; en modo admin arrastra el `?id=`. */
  ruta: (href: string) => string;
};

const Contexto = createContext<Ctx | null>(null);

export function useDj(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error("useDj fuera del panel DJ");
  return c;
}

const COLUMNAS = "id,profile_id,nombre_artistico,bio,estilos,redes,verificado,reputacion_score,oculto,avatar_url,playlist_url,zonas";

/**
 * Lee una ficha por su id o por la cuenta del dueño.
 *
 * `presskit_url` NO se pide por la tabla: desde el lote 65 (aplicado) esa
 * columna no tiene `grant select` y la consulta daba 403 en consola en cada
 * pantalla del panel antes de reintentar. La URL se pide a presskit_de(), que
 * al dueño (y a profesionales) sí se la da.
 */
async function leerFicha(campo: "id" | "profile_id", valor: string) {
  const { data, error } = await supabase.from("djs").select(COLUMNAS).eq(campo, valor)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  const ficha = (data as unknown as FichaDj | null) ?? null;
  if (!error && ficha) {
    const pk = await supabase.rpc("presskit_de", { p_dj: ficha.id });
    ficha.presskit_url = typeof pk.data === "string" ? pk.data : null;
  }
  return { ficha, error, sinColumna: false };
}

/** Consulta base de los tardeos en los que pincha un DJ (vía tardeo_djs). */
export function consultaTardeosDj(djId: string) {
  return supabase
    .from("tardeos")
    .select("id,titulo,fecha,hora_inicio,estado,flyer_url,locales(nombre,zona),tardeo_djs!inner(dj_id)", { count: "exact" })
    .eq("tardeo_djs.dj_id", djId);
}

export type TardeoDj = {
  id: string;
  titulo: string;
  fecha: string;
  hora_inicio: string | null;
  estado: string;
  flyer_url: string | null;
  locales: { nombre: string | null; zona: string | null } | null;
};

function Pantalla({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-marfil px-4">
      <div className="w-full max-w-md rounded-2xl border border-linea bg-white p-6 text-center shadow-tarjeta md:p-8">{children}</div>
    </main>
  );
}

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sin_ficha" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "ok"; dj: FichaDj; modoAdmin: boolean; sinColumna: boolean };

/**
 * Secciones nuevas del panel que lib/rutasPanel.ts aún no conoce. Sin esto
 * PanelDj las trataría como /dj/<slug> antiguo y la página se quedaría sin
 * contexto. (Lo correcto es añadirlas también allí para ocultar la cabecera
 * pública; esto es la red mientras tanto.)
 */
const SECCIONES_NUEVAS = ["/dj/resenas", "/dj/ayuda", "/dj/sets", "/dj/nexo"];

export default function PanelDj({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const enPanel = esRutaPanel(pathname) || SECCIONES_NUEVAS.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const { user, loading } = useAuth();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);
  // El `?id=` se lee de la URL a mano y no con useSearchParams: así el layout
  // no necesita Suspense y la redirección de /dj/<slug> sigue siendo un 307.
  const [idPedido, setIdPedido] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // Sincroniza con la URL del navegador (sistema externo): es justo el uso
    // previsto de un efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdPedido(new URLSearchParams(window.location.search).get("id"));
  }, [pathname]);

  useEffect(() => {
    if (!enPanel || loading || !user || idPedido === undefined) return;
    let vivo = true;
    (async () => {
      setEstado((e) => (e.tipo === "ok" ? e : { tipo: "cargando" }));
      let esAdmin = false;
      if (idPedido) {
        const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
        esAdmin = !!data?.is_admin;
      }
      // Sin ser admin el `?id=` se ignora: cada uno ve y edita solo lo suyo
      // (y la base lo impediría igualmente).
      const r = esAdmin && idPedido ? await leerFicha("id", idPedido) : await leerFicha("profile_id", user.id);
      if (!vivo) return;
      if (r.error) { setEstado({ tipo: "error", mensaje: r.error.message }); return; }
      if (!r.ficha) {
        setEstado(esAdmin ? { tipo: "error", mensaje: "No existe ninguna ficha de DJ con ese identificador." } : { tipo: "sin_ficha" });
        return;
      }
      setEstado({ tipo: "ok", dj: r.ficha, modoAdmin: esAdmin && r.ficha.profile_id !== user.id, sinColumna: r.sinColumna });
    })();
    return () => { vivo = false; };
  }, [enPanel, user, loading, idPedido, intento]);

  const actualizar = useCallback((cambios: Partial<FichaDj>) => {
    setEstado((e) => (e.tipo === "ok" ? { ...e, dj: { ...e.dj, ...cambios } } : e));
  }, []);

  // /dj/<slug> (enlaces antiguos) no es el panel: solo redirige.
  if (!enPanel) return <>{children}</>;

  // Sin sesión se decide al pintar (no hace falta esperar a ninguna consulta).
  const sinSesion = !loading && !user;

  if (sinSesion) {
    return (
      <Pantalla>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-magenta-50 text-magenta"><Disc3 size={32} aria-hidden /></span>
        <h1 className="mt-4 text-2xl font-bold">Entra para ver tu panel de DJ</h1>
        <p className="mt-2 text-base text-tinta-suave">Te mandamos un enlace a tu correo, sin contraseñas.</p>
        <Link href={entrarYVolver(pathname)} className={claseBoton("primario", "normal", true, "mt-5")}>Entrar</Link>
        <Link href="/" className={claseBoton("contorno", "normal", true, "mt-2")}>Volver a la web</Link>
      </Pantalla>
    );
  }

  if (estado.tipo === "cargando") {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2 bg-marfil text-[15px] text-tinta-suave" aria-busy>
        <Loader2 size={20} className="animate-spin" aria-hidden /> Cargando tu panel…
      </main>
    );
  }

  if (estado.tipo === "sin_ficha") {
    return (
      <Pantalla>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-magenta-50 text-magenta"><Disc3 size={32} aria-hidden /></span>
        <h1 className="mt-4 text-2xl font-bold">Aún no tienes perfil de DJ</h1>
        <p className="mt-2 text-base text-tinta-suave">
          Créalo en dos minutos: sales en el directorio de DJs, los locales te pueden añadir a sus tardeos y la gente te puede valorar.
        </p>
        <Link href="/unirse?rol=dj" className={claseBoton("primario", "normal", true, "mt-5")}>Crear mi perfil de DJ</Link>
        <Link href="/perfil" className={claseBoton("contorno", "normal", true, "mt-2")}>Volver a mi cuenta</Link>
      </Pantalla>
    );
  }

  if (estado.tipo === "error") {
    return (
      <Pantalla>
        <h1 className="text-2xl font-bold">No hemos podido abrir el panel</h1>
        <p className="mt-2 text-base text-tinta-suave">Puede ser la conexión. Vuelve a intentarlo en un momento.</p>
        <p className="mt-3 rounded-xl bg-error-fondo p-3 text-sm font-semibold text-error">{estado.mensaje}</p>
        <button onClick={() => setIntento((n) => n + 1)} className={claseBoton("primario", "normal", true, "mt-5")}>Reintentar</button>
        <Link href="/" className={claseBoton("contorno", "normal", true, "mt-2")}>Volver a la web</Link>
      </Pantalla>
    );
  }

  const { dj, modoAdmin, sinColumna } = estado;
  const ruta = (href: string) => (modoAdmin ? `${href}?id=${dj.id}` : href);

  // Menú del profesional según el vídeo (2:55), agrupado: eran trece entradas
  // sueltas y en el móvil no se encontraba nada. Cada entrada lleva sus
  // pantallas como pestañas arriba de la página (SubSecciones).
  // Fuera del menú: «Ver mi ficha pública» (está en Inicio) y «Modo claro» /
  // «Notificaciones», que son de la cuenta y siguen en Perfil (barra de abajo).
  const grupos: GrupoPanel[] = [
    {
      items: [
        { href: ruta("/dj"), label: "Inicio", icon: LayoutDashboard, exacto: true },
        {
          href: ruta("/dj/perfil"), label: "Mi perfil", icon: UserRound,
          hijas: [
            { href: ruta("/dj/perfil"), label: "Datos" },
            { href: ruta("/dj/presskit"), label: "PressKit", nota: dj.presskit_url ? undefined : "Sin subir" },
            { href: ruta("/dj/contenido"), label: "Fotos y flyers" },
            { href: ruta("/dj/resenas"), label: "Reseñas" },
          ],
        },
        {
          href: ruta("/dj/sets"), label: "Música", icon: Headphones,
          hijas: [
            { href: ruta("/dj/sets"), label: "Publicar set" },
            { href: ruta("/dj/nexo"), label: "Enviar a Nexo Radio" },
          ],
        },
        { href: ruta("/dj/tardeos"), label: "Mis eventos", icon: CalendarDays },
        { href: ruta("/dj/mensajes"), label: "Mensajes", icon: MessageCircle },
        { href: ruta("/dj/ayuda"), label: "Ayuda", icon: LifeBuoy },
      ],
    },
  ];

  return (
    <Contexto.Provider value={{ dj, actualizar, modoAdmin, sinColumnaPresskit: sinColumna, ruta }}>
      <PanelShell
        rol="Mi perfil DJ"
        nombre={dj.nombre_artistico}
        grupos={grupos}
        cabecera={modoAdmin ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-aviso">
              <ShieldCheck size={16} aria-hidden /> Editando como administración
            </p>
            <Link href="/admin/djs" className="text-sm font-semibold text-magenta-700 underline underline-offset-2">Volver a DJs del admin</Link>
          </div>
        ) : undefined}
      >
        {children}
      </PanelShell>
    </Contexto.Provider>
  );
}
