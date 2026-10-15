"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef } from "react";

/**
 * Pestañas de las pantallas hermanas, arriba de cada página del panel.
 *
 * La barra lateral enseña pocas entradas («Cola de trabajo», «Fichas»…) y cada
 * una agrupa varias pantallas. Para saltar entre ellas sin volver al menú
 * (en el móvil, abrir el cajón cada vez cansa) se pintan aquí como pestañas.
 *
 * No hace falta ponerlas a mano: `SeccionPanel` las pinta solas leyendo del
 * contexto que rellena `PanelShell` con la entrada activa. Una página que no
 * use `SeccionPanel` puede poner `<SubSecciones />` donde quiera.
 *
 * Son pestañas subrayadas y no pastillas a propósito: debajo del título las
 * páginas ya tienen sus `Filtros` en pastilla, y si todo es pastilla no se
 * distingue «cambiar de pantalla» de «filtrar esta lista».
 */
export type HijaPanel = {
  href: string;
  label: string;
  /** Pendientes. 0 o null no se pinta: solo se cuenta lo que pide algo. */
  badge?: number | null;
  /** Etiqueta pequeña («Apagado», «Pronto»). */
  nota?: string;
  exacto?: boolean;
};

export type ContextoSub = { titulo: string; hijas: HijaPanel[] } | null;
export const SubCtx = createContext<ContextoSub>(null);

/** ¿Esta ruta enciende el enlace? Sin el `?id=…` que arrastran local y DJ. */
export function rutaActiva(pathname: string, href: string, exacto?: boolean) {
  const base = href.split("?")[0];
  return exacto ? pathname === base : pathname === base || pathname.startsWith(base + "/");
}

export default function SubSecciones() {
  const sub = useContext(SubCtx);
  const pathname = usePathname();
  const fila = useRef<HTMLDivElement>(null);

  // En móvil no caben todas: se centra la activa moviendo SOLO la fila (con
  // scrollIntoView la página entera daba un salto vertical al entrar).
  useEffect(() => {
    const f = fila.current;
    const on = f?.querySelector<HTMLElement>("[aria-current=page]");
    if (f && on) f.scrollLeft = on.offsetLeft - f.clientWidth / 2 + on.clientWidth / 2;
  }, [pathname]);

  if (!sub) return null;

  return (
    <nav aria-label={`Apartados de ${sub.titulo}`} className="-mx-4 mb-4 border-b border-linea md:mx-0 md:mb-6">
      <div ref={fila} className="no-scrollbar flex gap-1 overflow-x-auto px-2 md:px-0">
        {sub.hijas.map((h) => {
          const on = rutaActiva(pathname, h.href, h.exacto);
          return (
            <Link key={h.href} href={h.href} aria-current={on ? "page" : undefined}
              className={`-mb-px inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-[3px] px-3 text-[15px] font-semibold transition-colors ${
                on ? "border-magenta text-tinta" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
              {h.label}
              {!!h.badge && h.badge > 0 && (
                <span className="grid min-w-[20px] place-items-center rounded-full bg-magenta px-1.5 text-xs font-bold leading-[20px] text-white">
                  {h.badge > 99 ? "99+" : h.badge}
                </span>
              )}
              {h.nota && <span className="text-[12px] font-medium text-tinta-suave">· {h.nota}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
