"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu, X, LogOut, ArrowLeft, Home, LifeBuoy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import ReportarProblema from "@/components/ReportarProblema";

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
  /** Número a la derecha (pendientes). 0 o null no se pinta. */
  badge?: number | null;
  /** Rutas que también encienden este item. */
  grupo?: string[];
  /** Solo se enciende con la ruta exacta (para las "home" de cada panel). */
  exacto?: boolean;
  /** Etiqueta pequeña ("Próximamente", "Desactivado"). */
  nota?: string;
};
export type GrupoPanel = { titulo?: string; items: ItemPanel[] };

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

  const activo = (i: ItemPanel) => {
    const base = i.href.split("?")[0];
    if (i.exacto) return pathname === base;
    return [base, ...(i.grupo ?? [])].some((g) => pathname === g || pathname.startsWith(g + "/"));
  };

  const actual = grupos.flatMap((g) => g.items).find(activo);

  const salir = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const navegacion = (
    <nav aria-label={rol} className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {grupos.map((g, gi) => (
        <div key={gi}>
          {g.titulo && (
            <p className="mb-1.5 px-3 text-[12px] font-semibold uppercase tracking-wider text-tinta-suave/80">{g.titulo}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const on = activo(i);
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
                      <span className="shrink-0 rounded-full bg-marfil-100 px-1.5 py-0.5 text-[11px] font-semibold text-tinta-suave">{i.nota}</span>
                    )}
                    {!!i.badge && i.badge > 0 && (
                      <span className="grid min-w-[22px] place-items-center rounded-full bg-magenta px-1.5 text-xs font-bold leading-[22px] text-white">
                        {i.badge > 99 ? "99+" : i.badge}
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
    </div>
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
        <p className="text-[12px] font-semibold uppercase tracking-wider text-magenta">{rol}</p>
        <p className="truncate text-[15px] font-bold leading-tight">{nombre || "TardeosClub"}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-marfil lg:pl-[264px]">
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
          <p className="text-[11px] font-semibold uppercase leading-none tracking-wider text-magenta">{rol}</p>
          <p className="truncate text-base font-bold leading-tight">{actual?.label ?? nombre ?? ""}</p>
        </div>
        <Link href="/" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-linea-fuerte px-3 text-[14px] font-semibold text-tinta hover:bg-marfil-100">
          <Home size={17} aria-hidden /> Web
        </Link>
      </header>

      {/* Secciones siempre a la vista en móvil (el ☰ solo no lo descubre
          nadie). Fila deslizable; la activa se centra al entrar. */}
      <nav aria-label={`Secciones · ${rol}`}
        className="no-scrollbar sticky top-14 z-[790] flex gap-1.5 overflow-x-auto border-b border-linea bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        {grupos.flatMap((g) => g.items).map((i) => {
          const on = activo(i);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
              ref={on ? (el) => el?.scrollIntoView({ block: "nearest", inline: "center" }) : undefined}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${
                on ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta"}`}>
              <i.icon size={16} aria-hidden />
              {i.label}
              {!!i.badge && i.badge > 0 && (
                <span className={`rounded-full px-1.5 text-xs font-bold ${on ? "bg-white/20" : "bg-magenta text-white"}`}>{i.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Cajón móvil */}
      {abierto && (
        <div className="fixed inset-0 z-[2000] lg:hidden">
          <div className="absolute inset-0 bg-tinta/50" onClick={() => setAbierto(false)} aria-hidden />
          <aside role="dialog" aria-modal="true" aria-label={`Menú · ${rol}`}
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-white shadow-elevada">
            {volverWeb}
            <div className="relative">
              {marca}
              <button onClick={() => setAbierto(false)} aria-label="Cerrar menú"
                className="absolute right-2 top-1/2 grid min-h-tacto min-w-tacto -translate-y-1/2 place-items-center rounded-lg hover:bg-marfil-100">
                <X size={22} />
              </button>
            </div>
            {cabecera && <div className="border-b border-linea px-4 py-3">{cabecera}</div>}
            {navegacion}
            <div className="pb-[env(safe-area-inset-bottom)]">{pie}</div>
          </aside>
        </div>
      )}

      <div className="min-w-0">{children}</div>
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
