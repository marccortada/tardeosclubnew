"use client";

import PoweredByGnerai from "@/components/PoweredByGnerai";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu, X, LogOut, ArrowLeft, Home, LifeBuoy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import ReportarProblema from "@/components/ReportarProblema";
import SubSecciones, { SubCtx, rutaActiva, type ContextoSub, type HijaPanel } from "@/components/panel/SubSecciones";
import { MARCA } from "@/lib/marca";

export type { HijaPanel };

/**
 * El esqueleto común de TODOS los paneles: admin, local/promotor, DJ y
 * tardícola. Barra lateral fija en escritorio y cajón deslizante en móvil.
 *
 * Antes cada panel era una página larga con todo apilado (y el admin, un hub
 * de tarjetas): para llegar a "Fotos" había que bajar seis pantallas. Con la
 * barra lateral cada sección es una ruta, se llega en un toque y el navegador
 * recuerda dónde estabas.
 */
export type ItemPanel = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Número a la derecha (pendientes). 0 o null no se pinta. Si no se da y
   *  hay `hijas`, se suman las de las hijas. */
  badge?: number | null;
  /** Rutas que también encienden este item. */
  grupo?: string[];
  /** Solo se enciende con la ruta exacta (para las "home" de cada panel). */
  exacto?: boolean;
  /** Etiqueta pequeña ("Próximamente", "Desactivado"). */
  nota?: string;
  /**
   * Pantallas que cuelgan de esta entrada. La barra enseña solo la entrada
   * (el admin tenía 30 en la barra y nadie encontraba nada); las hijas salen
   * como pestañas arriba de cada página (`SubSecciones`, dentro de
   * `SeccionPanel`) y cualquiera de ellas enciende la entrada.
   */
  hijas?: HijaPanel[];
};
export type GrupoPanel = { titulo?: string; items: ItemPanel[] };

const sumaBadges = (hijas: HijaPanel[]) => {
  const n = hijas.reduce((t, h) => t + (h.badge ?? 0), 0);
  return n > 0 ? n : null;
};

export default function PanelShell({
  rol, nombre, grupos, children, cabecera,
}: {
  /** "Administración", "Mi local", "Mi perfil DJ", "Mi cuenta"… */
  rol: string;
  /** Nombre del local / DJ / usuario bajo el rol. */
  nombre?: string | null;
  grupos: GrupoPanel[];
  children: ReactNode;
  /** Contenido extra en la cabecera de la barra (p. ej. un selector). */
  cabecera?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [abierto, setAbierto] = useState(false);

  // Cerrar el cajón al navegar.
  useEffect(() => { setAbierto(false); }, [pathname]);
  // Bloquear el scroll de detrás con el cajón abierto.
  useEffect(() => {
    if (!abierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const activo = (i: ItemPanel) =>
    rutaActiva(pathname, i.href, i.exacto)
    || (i.grupo ?? []).some((g) => rutaActiva(pathname, g))
    || (i.hijas ?? []).some((h) => rutaActiva(pathname, h.href, h.exacto));
  const badgeDe = (i: ItemPanel) => (i.badge !== undefined ? i.badge : i.hijas ? sumaBadges(i.hijas) : null);

  const actual = grupos.flatMap((g) => g.items).find(activo);
  const hijaActual = actual?.hijas?.find((h) => rutaActiva(pathname, h.href, h.exacto));
  // Con una sola hija no hay entre qué saltar: no se pintan pestañas.
  const sub: ContextoSub = actual?.hijas && actual.hijas.length > 1 ? { titulo: actual.label, hijas: actual.hijas } : null;

  const salir = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const navegacion = (
    <nav aria-label={rol} className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3 lg:gap-5 lg:py-4">
      {grupos.map((g, gi) => (
        <div key={gi}>
          {g.titulo && (
            <p className="mb-1.5 px-3 text-[13px] font-semibold uppercase tracking-wider text-tinta-suave">{g.titulo}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const on = activo(i);
              const badge = badgeDe(i);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    className={`group flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors ${
                      on ? "bg-magenta-50 text-magenta-700" : "text-tinta hover:bg-marfil-100"
                    }`}
                  >
                    <i.icon size={19} strokeWidth={on ? 2.4 : 2} className={on ? "text-magenta" : "text-tinta-suave group-hover:text-tinta"} aria-hidden />
                    <span className="flex-1 truncate">{i.label}</span>
                    {i.nota && (
                      <span className="shrink-0 rounded-full bg-marfil-100 px-1.5 py-0.5 text-[13px] font-semibold text-tinta-suave">{i.nota}</span>
                    )}
                    {!!badge && badge > 0 && (
                      <span className="grid min-w-[22px] place-items-center rounded-full bg-magenta px-1.5 text-xs font-bold leading-[22px] text-white">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const pie = (
    <div className="border-t border-linea px-3 py-3">
      <ReportarProblema
        etiqueta={<><LifeBuoy size={18} aria-hidden /><span className="flex-1 truncate">¿Algo no funciona?</span></>}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold text-tinta-suave hover:bg-marfil-100 hover:text-tinta"
      />
      {user && (
        <button onClick={salir} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold text-tinta-suave hover:bg-marfil-100 hover:text-tinta">
          <LogOut size={18} aria-hidden />
          <span className="flex-1 truncate">Salir <span className="font-normal">· {user.email}</span></span>
        </button>
      )}
      <PoweredByGnerai className="mt-1 px-3 text-tinta-suave" />
    </div>
  );

  // En el cajón del móvil el pie va en una sola fila: con el menú completo y
  // dos filas de pie, en un teléfono normal el último bloque quedaba tapado.
  const pieMovil = (
    <>
    <div className="flex items-center gap-1 border-t border-linea px-2 py-2">
      <ReportarProblema
        etiqueta={<><LifeBuoy size={18} aria-hidden /><span className="truncate">¿Algo no funciona?</span></>}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-[15px] font-semibold text-tinta-suave hover:bg-marfil-100 hover:text-tinta"
      />
      {user && (
        <button onClick={salir} aria-label={`Salir de ${user.email}`}
          className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg px-3 text-[15px] font-semibold text-tinta-suave hover:bg-marfil-100 hover:text-tinta">
          <LogOut size={18} aria-hidden /> Salir
        </button>
      )}
    </div>
    {/* Fila propia: en la de arriba no cabía sin cortar «¿Algo no funciona?». */}
    <div className="flex justify-center pb-2 text-tinta-suave"><PoweredByGnerai /></div>
    </>
  );

  // Volver a la web, arriba del todo y con texto: con el icono solo, nadie
  // sabía cómo salir del panel.
  const volverWeb = (
    <Link href="/" className="flex min-h-[44px] items-center gap-2 border-b border-linea px-5 text-[14px] font-semibold text-tinta-suave hover:bg-marfil-100 hover:text-tinta">
      <ArrowLeft size={17} aria-hidden /> Volver a la web
    </Link>
  );

  const marca = (
    <div className="flex items-center gap-3 border-b border-linea px-5 py-4">
      <Link href="/" aria-label="Ir a la portada" className="shrink-0">
        <Image src="/branding/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
      </Link>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-magenta">{rol}</p>
        <p className="truncate text-[15px] font-bold leading-tight">{nombre || MARCA.nombre}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-marfil lg:pl-[264px]">
      {/* Barra lateral fija (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-[800] hidden w-[264px] flex-col border-r border-linea bg-white lg:flex">
        {volverWeb}
        {marca}
        {cabecera && <div className="border-b border-linea px-4 py-3">{cabecera}</div>}
        {navegacion}
        {pie}
      </aside>

      {/* Cabecera móvil */}
      <header className="sticky top-0 z-[800] flex h-14 items-center gap-2 border-b border-linea bg-white/95 px-2 backdrop-blur lg:hidden">
        <button onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto}
          className="grid min-h-tacto min-w-tacto place-items-center rounded-lg text-tinta hover:bg-marfil-100">
          <Menu size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase leading-none tracking-wider text-magenta">{rol}</p>
          <p className="truncate text-base font-bold leading-tight">{hijaActual?.label ?? actual?.label ?? nombre ?? ""}</p>
        </div>
        <Link href="/" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-linea-fuerte px-3 text-[14px] font-semibold text-tinta hover:bg-marfil-100">
          <Home size={17} aria-hidden /> Web
        </Link>
      </header>

      {/* Secciones a la vista al entrar en móvil (el ☰ solo no lo descubre
          nadie). Fila deslizable; la activa se centra al entrar. NO es fija:
          cabecera + esta fila + barra de abajo fijas se comían casi 180 px de
          una pantalla de 812; al bajar se va y deja sitio al contenido. */}
      <nav aria-label={`Secciones · ${rol}`}
        className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-linea bg-superficie px-3 py-2 lg:hidden">
        {grupos.flatMap((g) => g.items).map((i) => {
          const on = activo(i);
          const badge = badgeDe(i);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
              ref={on ? (el) => el?.scrollIntoView({ block: "nearest", inline: "center" }) : undefined}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${
                on ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta"}`}>
              <i.icon size={16} aria-hidden />
              {i.label}
              {!!badge && badge > 0 && (
                <span className={`rounded-full px-1.5 text-xs font-bold ${on ? "bg-white/20" : "bg-magenta text-white"}`}>{badge > 99 ? "99+" : badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Cajón móvil */}
      {abierto && (
        <div className="fixed inset-0 z-[2000] lg:hidden">
          <div className="absolute inset-0 bg-noche/60" onClick={() => setAbierto(false)} aria-hidden />
          <aside role="dialog" aria-modal="true" aria-label={`Menú · ${rol}`}
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-white shadow-elevada">
            {/* Sin «Volver a la web»: en el móvil ya está el botón «Web» de la
                cabecera, y aquí robaba una fila al menú. */}
            <div className="relative">
              {marca}
              <button onClick={() => setAbierto(false)} aria-label="Cerrar menú"
                className="absolute right-2 top-1/2 grid min-h-tacto min-w-tacto -translate-y-1/2 place-items-center rounded-lg hover:bg-marfil-100">
                <X size={22} />
              </button>
            </div>
            {cabecera && <div className="border-b border-linea px-4 py-3">{cabecera}</div>}
            {navegacion}
            <div className="pb-[env(safe-area-inset-bottom)]">{pieMovil}</div>
          </aside>
        </div>
      )}

      <SubCtx.Provider value={sub}>
        <div className="min-w-0">{children}</div>
      </SubCtx.Provider>
    </div>
  );
}

/**
 * Cabecera de cada sección dentro de un panel: título, descripción corta y
 * acciones a la derecha. Sustituye a PanelHeader (con flecha de volver) dentro
 * de los paneles: con barra lateral, "volver" no hace falta.
 */
export function SeccionPanel({
  titulo, descripcion, acciones, children, ancho = "normal",
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  ancho?: "normal" | "ancho" | "estrecho";
}) {
  // Alineado a la izquierda, junto a la barra lateral, y con el mismo ancho
  // en todas las secciones: centrado, cada pantalla quedaba a una altura
  // distinta y con un hueco enorme a la derecha en las estrechas.
  const max = ancho === "estrecho" ? "max-w-3xl" : "max-w-7xl";
  return (
    <main className={`w-full ${max} px-4 pb-16 pt-5 md:px-8 md:pt-8`}>
      {/* Pestañas con las hermanas de esta pantalla (si la entrada de la barra
          agrupa varias). Va aquí y no en cada página: así sale en todas, con
          el mismo ancho que el contenido, sin tocar ninguna. */}
      <SubSecciones />
      <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{titulo}</h1>
          {descripcion && <p className="mt-1 text-[15px] text-tinta-suave">{descripcion}</p>}
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
      {children}
    </main>
  );
}
