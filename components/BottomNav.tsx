"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { useRoles } from "@/lib/permisos";
import { sincronizarTema } from "@/lib/tardicola";
import { ocultaBarraInferior, esRutaPanel } from "@/lib/rutasPanel";
import { Home, CalendarDays, Headphones, Bookmark, User, Users } from "lucide-react";

/**
 * Barra de la app (dossier pág. 3). Cinco pestañas; la cuarta cambia según el
 * permiso: el tardícola ve Próxima Parada y el profesional Entre Beats (su
 * Próxima Parada y su panel se abren desde Perfil). Ocultarla no protege
 * nada: Entre Beats se protege en la base (lote 63/66).
 */
const TARDICOLA = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/djs", label: "DJs", icon: Headphones },
  { href: "/proxima-parada", label: "Próxima Parada", icon: Bookmark },
  { href: "/perfil", label: "Perfil", icon: User },
];
const PROFESIONAL = [
  ...TARDICOLA.slice(0, 3),
  { href: "/entre-beats", label: "Entre Beats", icon: Users },
  TARDICOLA[4],
];

/** Pestaña activa: la ficha de un tardeo cuenta como Eventos. */
function activa(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/eventos") return pathname.startsWith("/eventos") || pathname.startsWith("/tardeos") || pathname.startsWith("/directorio");
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { esProfesional } = useRoles();

  // El tema guardado en la cuenta manda (vale entre dispositivos).
  useEffect(() => { if (user) sincronizarTema(user.id); }, [user]);

  if (ocultaBarraInferior(pathname)) return null;
  const tabs = esProfesional ? PROFESIONAL : TARDICOLA;

  return (
    <>
      {/* Hueco para que la barra fija no tape el final de la página. */}
      <div aria-hidden className={`h-24 ${esRutaPanel(pathname) ? "md:hidden" : "md:h-12"}`} />
      <nav aria-label="Principal"
        className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-linea bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const on = activa(href, pathname);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className="flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5">
                <Icon size={24} strokeWidth={on ? 2.4 : 1.9} className={on ? "text-magenta" : "text-tinta-suave"} aria-hidden />
                <span className={`max-w-full px-0.5 text-center text-[12px] font-semibold leading-[1.1] ${on ? "text-magenta" : "text-tinta-suave"}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
