"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Home, CalendarDays, Headphones, Bookmark, Radio, ArrowUpRight, Users } from "lucide-react";
import { useRoles } from "@/lib/permisos";
import { Campana } from "@/components/CabeceraApp";
import { esRutaPanel, esRutaPanelConSesion } from "@/lib/rutasPanel";
import { usePortal } from "@/components/cuenta/usePortal";

/**
 * Los enlaces de la cabecera, los mismos que tenía tardeosclub.com. «Mis
 * planes» solo con sesión: sin ella lleva a un login que no dice para qué.
 * Nexo Radio es externa y se abre aparte.
 */
// Las mismas pestañas que la barra de la app (v2), más Nexo Radio, que ya es
// una sección propia (/nexo, equipo B).
const links: { href: string; label: string; icono: typeof Home; externo?: boolean; conSesion?: boolean; pro?: boolean; tardicola?: boolean }[] = [
  { href: "/", label: "Inicio", icono: Home },
  { href: "/eventos", label: "Eventos", icono: CalendarDays },
  { href: "/djs", label: "DJs", icono: Headphones },
  { href: "/proxima-parada", label: "Próxima Parada", icono: Bookmark, conSesion: true, tardicola: true },
  { href: "/entre-beats", label: "Entre Beats", icono: Users, pro: true },
  { href: "/nexo", label: "Nexo Radio", icono: Radio },
];

/** El botón de entrar, rosa neón → oro como el de la web de siempre. El texto
 *  va oscuro (`sobre-oro`, fijo en los dos temas): el blanco, aun con sombra,
 *  se quedaba en ~1,6:1 sobre el extremo dorado; el oscuro da ≥4,9:1 en todo
 *  el degradado (5:1 en el rosa, 9:1 en el oro). */
export const claseEntrar =
  "inline-flex min-h-[44px] items-center rounded-[14px] bg-gradient-to-r from-[#FF3DCF] to-[#FAC72E] px-5 text-[15px] font-bold text-sobre-oro shadow-tarjeta transition hover:brightness-105 active:scale-[0.98]";

export default function SiteNav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  // Con sesión, el botón lleva al portal de cada cuenta (admin, local, DJ…).
  const portal = usePortal(user?.id);
  const { esProfesional } = useRoles();

  if (esRutaPanel(pathname) || (user && esRutaPanelConSesion(pathname))) return null;

  return (
    <header className="sticky top-0 z-[900] hidden border-b border-linea bg-superficie/95 backdrop-blur-md md:block">
      <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between gap-4 px-6 lg:px-8">
        {/* Logo redondo, como en la web de siempre. */}
        <Link href="/" aria-label="TardeosClub, inicio" className="shrink-0">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-linea bg-white shadow-tarjeta">
            <Image src="/branding/logo-transp.png" alt="TardeosClub" width={150} height={90} priority className="h-auto w-12" />
          </span>
        </Link>

        <nav aria-label="Principal" className="flex items-center gap-1">
          {links.filter((l) => (!l.conSesion || user) && (!l.pro || esProfesional) && (!l.tardicola || !esProfesional)).map(({ href, label, icono: Icono, externo }) => {
            const active = !externo && (href === "/" ? pathname === "/" : pathname.startsWith(href));
            // Activa en píldora oro: se ve de lejos dónde estás.
            const cls = `inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-[15px] font-medium transition lg:px-3.5 ${
              active ? "bg-oro font-semibold text-sobre-oro shadow-tarjeta" : "text-tinta hover:bg-marfil-100"
            }`;
            const contenido = (
              <>
                {/* Los iconos solo donde caben: a 768 px no entran todos. */}
                <Icono size={17} className="hidden shrink-0 lg:block" aria-hidden /> {label}
              </>
            );
            // Nexo Radio es OTRA web (radio colaboradora): va aparte, tras una
            // raya, en píldora oscura con su logo y la flecha de "sale fuera",
            // para que nadie la confunda con una sección de TardeosClub.
            return externo ? (
              <span key={href} className="ml-2 flex items-center gap-3 border-l border-linea pl-3">
                <a href={href} target="_blank" rel="noopener noreferrer"
                  title={`${label} · radio colaboradora, se abre en otra pestaña`}
                  className="group inline-flex min-h-[44px] items-center gap-2 rounded-full bg-noche py-1 pl-1 pr-3.5 text-[14px] font-semibold text-white shadow-tarjeta transition hover:bg-black">
                  <Image src="/branding/nexo-radio.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full bg-white object-contain" />
                  {label}
                  <ArrowUpRight size={15} className="opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                  <span className="sr-only">(se abre en otra web)</span>
                </a>
              </span>
            ) : (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cls}>{contenido}</Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {user && <Campana />}
          {/*
            El botón cambia según haya sesión o no.
            `useAuth` ya se pedía aquí desde el principio y no se usaba: el
            botón decía «Entrar / Únete» también a quien acababa de entrar.
            Invitar a registrarse a alguien que ya está dentro es de las cosas
            que más rápido hacen dudar de que una web esté terminada.

            Mientras se resuelve la sesión no se pinta ninguno de los dos, solo
            el hueco: enseñar «Entrar» medio segundo y cambiarlo por «Mi
            cuenta» es peor que no enseñar nada, porque parpadea en cada carga.
          */}
          {loading || (user && !portal) ? (
            <span aria-hidden className="h-[44px] w-[132px] rounded-[14px] bg-marfil-100" />
          ) : user && portal ? (
            <Link
              href={portal.href}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border border-linea-fuerte bg-white px-4 text-[15px] font-bold text-tinta transition hover:border-tinta/40 hover:bg-marfil"
            >
              <portal.icono size={18} aria-hidden /> {portal.label}
            </Link>
          ) : (
            <Link
              href="/perfil"
              className={claseEntrar}
            >
              Entrar / Únete
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
