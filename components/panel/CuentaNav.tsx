"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  House, Heart, Sparkles, Bell, Settings, Store, Megaphone, Disc3, ShieldCheck, LogOut, Loader2, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { hoyISO } from "@/lib/tardeos";
import { useAuth } from "@/lib/useAuth";
import PanelShell, { SeccionPanel, type GrupoPanel } from "@/components/panel/PanelShell";

/**
 * "Mi cuenta" del tardícola: datos de la cuenta y su menú. Las páginas se
 * pintan con `MarcoCuenta`, que usa el mismo PanelShell que los demás
 * portales (barra lateral fija en escritorio). `CuentaNav` queda para quien
 * quiera el menú suelto.
 */

export type DatosCuenta = {
  nombre: string | null;
  esAdmin: boolean;
  /** Ficha de local/promotor que lleva, si tiene. */
  ficha: { id: string; tipo: "local" | "promotor"; nombre: string } | null;
  esDj: boolean;
  /** Inscripciones (apuntados) de cualquier fecha. */
  nInscripciones: number;
  /** Apuntados a tardeos de hoy en adelante: el número del menú. */
  nProximas: number;
};

// La piden la barra y la página a la vez: una consulta sirve a las dos. Caduca
// al minuto para que un "Apuntarme" reciente aparezca al volver a la cuenta.
const cache = new Map<string, { p: Promise<DatosCuenta>; en: number }>();

export function cargarDatosCuenta(uid: string): Promise<DatosCuenta> {
  const hay = cache.get(uid);
  if (hay && Date.now() - hay.en < 60_000) return hay.p;
  const p = (async () => {
    const [perfil, local, dj, ins, prox] = await Promise.all([
      supabase.from("profiles").select("is_admin,display_name").eq("id", uid).maybeSingle(),
      supabase.from("locales").select("id,tipo,nombre").eq("owner_id", uid).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("djs").select("id").eq("profile_id", uid).limit(1).maybeSingle(),
      supabase.from("inscripciones").select("id", { count: "exact", head: true }).eq("profile_id", uid).eq("estado", "apuntado"),
      // `!inner` para poder contar solo las de tardeos que aún no han pasado.
      supabase.from("inscripciones").select("id, tardeo:tardeos!inner(fecha)", { count: "exact", head: true })
        .eq("profile_id", uid).eq("estado", "apuntado").gte("tardeo.fecha", hoyISO()),
    ]);
    return {
      nombre: perfil.data?.display_name ?? null,
      esAdmin: Boolean(perfil.data?.is_admin),
      ficha: local.data ? { id: local.data.id, tipo: local.data.tipo === "promotor" ? "promotor" : "local", nombre: local.data.nombre } : null,
      esDj: Boolean(dj.data),
      nInscripciones: ins.count ?? 0,
      nProximas: prox.count ?? 0,
    } as DatosCuenta;
  })();
  cache.set(uid, { p, en: Date.now() });
  // Si falla, que el siguiente intento vuelva a preguntar.
  p.catch(() => cache.delete(uid));
  return p;
}

/** Olvida lo guardado (p. ej. tras cambiar el nombre o borrar la cuenta). */
export function invalidarDatosCuenta(uid?: string) {
  if (uid) cache.delete(uid); else cache.clear();
}

export function useDatosCuenta() {
  const { user, loading } = useAuth();
  const [datos, setDatos] = useState<DatosCuenta | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!user) { setDatos(null); return; }
    let vivo = true;
    cargarDatosCuenta(user.id).then((d) => { if (vivo) setDatos(d); }).catch(() => { /* el menú sale sin números */ });
    return () => { vivo = false; };
  }, [user, version]);
  /** Vuelve a pedir los datos (la barra muestra el nombre nuevo, etc.). */
  const recargar = () => { if (user) cache.delete(user.id); setVersion((v) => v + 1); };
  return { user, loading, datos, recargar };
}

type Item = { href: string; label: string; icon: LucideIcon; exacto?: boolean; badge?: number };

function itemsDe(d: DatosCuenta | null): { cuenta: Item[]; paneles: Item[] } {
  // Cinco cosas, siempre las mismas y en este orden. "Mis reservas" ya no
  // existe: es la pestaña "Me he apuntado" de Mis planes. El número de Mis
  // planes cuenta solo lo que está por venir (lo pasado no pide nada).
  const cuenta: Item[] = [
    { href: "/perfil", label: "Inicio", icon: House, exacto: true },
    { href: "/favoritos", label: "Mis planes", icon: Heart, badge: d?.nProximas || undefined },
    { href: "/perfil/gustos", label: "Mis gustos", icon: Sparkles },
    { href: "/perfil/notificaciones", label: "Avisos", icon: Bell },
    { href: "/perfil/ajustes", label: "Ajustes", icon: Settings },
  ];
  const paneles: Item[] = [];
  if (d?.ficha) paneles.push({ href: "/local", label: d.ficha.tipo === "promotor" ? "Mis eventos" : "Mi local", icon: d.ficha.tipo === "promotor" ? Megaphone : Store });
  if (d?.esDj) paneles.push({ href: "/dj", label: "Mi perfil DJ", icon: Disc3 });
  if (d?.esAdmin) paneles.push({ href: "/admin", label: "Administración", icon: ShieldCheck });
  return { cuenta, paneles };
}

/** Cierra sesión y vuelve a la portada, con estado de carga y error visible. */
export function useCerrarSesion() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState("");
  const salir = async () => {
    setSaliendo(true); setError("");
    const { error: e } = await supabase.auth.signOut();
    if (e) { setSaliendo(false); setError("No se pudo cerrar la sesión. Inténtalo otra vez."); return; }
    cache.clear();
    router.push("/");
  };
  return { salir, saliendo, error };
}

export default function CuentaNav({ datos }: { datos: DatosCuenta | null }) {
  const pathname = usePathname();
  const { salir, saliendo, error } = useCerrarSesion();
  const { cuenta, paneles } = itemsDe(datos);
  const activo = (i: Item) => (i.exacto ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/"));

  const enlace = (i: Item) => {
    const on = activo(i);
    return (
      <li key={i.href}>
        <Link
          href={i.href}
          aria-current={on ? "page" : undefined}
          className={`group flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors ${
            on ? "bg-magenta-50 text-magenta-700" : "text-tinta hover:bg-marfil-100"
          }`}
        >
          <i.icon size={19} strokeWidth={on ? 2.4 : 2} className={on ? "text-magenta" : "text-tinta-suave group-hover:text-tinta"} aria-hidden />
          <span className="flex-1 truncate">{i.label}</span>
          {!!i.badge && (
            <span className="grid min-w-[24px] place-items-center rounded-full bg-marfil-200 px-1.5 text-[13px] font-bold leading-[24px] text-tinta">
              {i.badge > 99 ? "99+" : i.badge}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <>
      {/* Escritorio: columna fija a la izquierda. */}
      <nav aria-label="Mi cuenta" className="sticky top-24 hidden self-start rounded-2xl border border-linea bg-white p-3 shadow-tarjeta lg:block">
        <p className="px-3 pb-1 pt-1 text-[12px] font-semibold uppercase tracking-wider text-tinta-suave">Mi cuenta</p>
        <ul className="flex flex-col gap-0.5">{cuenta.map(enlace)}</ul>
        {paneles.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-wider text-tinta-suave">Mis paneles</p>
            <ul className="flex flex-col gap-0.5">{paneles.map(enlace)}</ul>
          </>
        )}
        <div className="mt-3 border-t border-linea pt-3">
          <button
            onClick={salir}
            disabled={saliendo}
            className="flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-tinta-suave transition hover:bg-marfil-100 hover:text-tinta disabled:opacity-60"
          >
            {saliendo ? <Loader2 size={19} className="animate-spin" aria-hidden /> : <LogOut size={19} aria-hidden />} Cerrar sesión
          </button>
          {error && <p role="alert" className="px-3 pt-1 text-[14px] font-semibold text-error">{error}</p>}
        </div>
      </nav>

      {/* Móvil y tableta: pestañas que se deslizan. Los paneles van al final. */}
      <nav aria-label="Mi cuenta" className="-mx-4 mb-5 border-b border-linea bg-white px-4 lg:hidden">
        <ul className="no-scrollbar flex gap-1 overflow-x-auto py-2">
          {[...cuenta, ...paneles].map((i) => {
            const on = activo(i);
            return (
              <li key={i.href} className="shrink-0">
                <Link
                  href={i.href}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition ${
                    on ? "bg-tinta text-white" : "text-tinta hover:bg-marfil-100"
                  }`}
                >
                  <i.icon size={17} aria-hidden /> {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/**
 * Marco de cada página de la cuenta: el MISMO panel con barra lateral fija
 * que el local, el DJ y el admin (en móvil, pestañas arriba y la barra de
 * abajo de la web). Antes era una columna dentro de la página que se iba con
 * el scroll.
 */
export function MarcoCuenta({
  titulo, descripcion, acciones, children, datos, ancho,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  datos: DatosCuenta | null;
  ancho?: "normal" | "ancho" | "estrecho";
}) {
  const { cuenta, paneles } = itemsDe(datos);
  const grupos: GrupoPanel[] = [
    { titulo: paneles.length ? "Mi cuenta" : undefined, items: cuenta.map((i) => ({ href: i.href, label: i.label, icon: i.icon, exacto: i.exacto, badge: i.badge })) },
  ];
  // Quien lleva un local, es DJ o admin entra sobre todo a trabajar: sus
  // paneles van arriba del todo y en grande (cabecera de la barra y cajón
  // móvil), no al final de la lista como un enlace más.
  const destacados = paneles.length > 0 && (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-magenta">Mis paneles</p>
      <ul className="flex flex-col gap-1.5">
        {paneles.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="flex min-h-[48px] items-center gap-3 rounded-xl bg-magenta px-3 text-[15px] font-bold text-white shadow-tarjeta transition hover:bg-magenta-600">
              <i.icon size={19} aria-hidden /> <span className="flex-1 truncate">{i.label}</span> <ArrowRight size={17} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <PanelShell rol="Mi cuenta" nombre={datos?.nombre ?? "Tardícola"} grupos={grupos} cabecera={destacados || undefined}>
      {/* En móvil la cabecera de la barra solo se ve abriendo el menú: los
          paneles se ponen también arriba de la página, siempre a la vista. */}
      {destacados && (
        <div className="flex flex-wrap gap-2 border-b border-linea bg-white px-4 py-3 lg:hidden">
          {paneles.map((i) => (
            <Link key={i.href} href={i.href} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-magenta px-4 text-[15px] font-bold text-white">
              <i.icon size={18} aria-hidden /> Ir a {i.label.charAt(0).toLowerCase() + i.label.slice(1)}
            </Link>
          ))}
        </div>
      )}
      <SeccionPanel titulo={titulo} descripcion={descripcion} acciones={acciones} ancho={ancho}>
        {children}
      </SeccionPanel>
    </PanelShell>
  );
}

/** Pantalla de "cargando" de la cuenta, a la misma altura que el contenido. */
export function CargandoCuenta() {
  return (
    <main className="flex items-center justify-center gap-2 pt-24 text-[16px] text-tinta-suave">
      <Loader2 className="animate-spin" aria-hidden /> Cargando…
    </main>
  );
}
