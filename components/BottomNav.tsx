"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { ocultaBarraInferior, esRutaPanel } from "@/lib/rutasPanel";
import { Home, CalendarDays, MapPin, Heart, User, Store, Megaphone, Disc3 } from "lucide-react";

// Cinco pestañas: caben sin encoger nada y cada una se acierta con el pulgar.
// "Colaboradores" salió de aquí (se llega desde la portada y el pie): con siete
// pestañas las etiquetas bajaban a 9 px, ilegible a partir de los 30.
const BASE = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/tardeos", label: "Tardeos", icon: CalendarDays },
  { href: "/mapa", label: "Mapa", icon: MapPin },
  { href: "/favoritos", label: "Planes", icon: Heart },
  { href: "/perfil", label: "Cuenta", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [ficha, setFicha] = useState<"local" | "promotor" | "dj" | null>(null);

  // La pestaña de su panel solo aparece a quien tiene ficha: para un
  // tardícola normal sería un enlace a una página que le dice que no tiene
  // nada. Local/promotor tiene prioridad; si solo es DJ, sale "DJ". (Con las
  // dos, el panel de DJ está en Cuenta: siete pestañas no caben a 12 px.)
  useEffect(() => {
    if (!user) { setFicha(null); return; }
    Promise.all([
      supabase.from("locales").select("tipo").eq("owner_id", user.id).limit(1).maybeSingle(),
      supabase.from("djs").select("id").eq("profile_id", user.id).limit(1).maybeSingle(),
    ]).then(([l, d]) =>
      setFicha(l.data ? (l.data.tipo === "promotor" ? "promotor" : "local") : d.data ? "dj" : null));
  }, [user]);

  // A quien tiene ficha se le añade su panel entre Mapa y Planes: seis pestañas,
  // con etiquetas cortas para que sigan a 12 px.
  // El admin tiene su propio menú: ahí no se pinta.
  if (ocultaBarraInferior(pathname)) return null;

  const tabs = ficha
    ? [
        ...BASE.slice(0, 3),
        ficha === "dj"
          ? { href: "/dj", label: "Mi DJ", icon: Disc3 }
          : {
              href: "/local",
              label: ficha === "promotor" ? "Eventos" : "Mi local",
              icon: ficha === "promotor" ? Megaphone : Store,
            },
        ...BASE.slice(3),
      ]
    : BASE;

  return (
    <>
    {/* Hueco para que la barra fija no tape el final de la página. */}
    <div aria-hidden className={`h-24 ${esRutaPanel(pathname) ? "md:hidden" : "md:h-12"}`} />
    <nav
      aria-label="Principal"
      className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-linea bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          // Exacto o subruta: "/dj" no debe encenderse en "/djs/…" (ficha pública).
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5"
            >
              {/* Píldora detrás del icono activo: se ve en qué pestaña estás sin
                  depender solo del color. */}
              <span className={`grid h-8 w-14 place-items-center rounded-full transition ${active ? "bg-magenta-50" : ""}`}>
                <Icon size={24} strokeWidth={active ? 2.4 : 2} className={active ? "text-magenta" : "text-tinta-suave"} aria-hidden />
              </span>
              <span className={`text-[12px] font-semibold leading-none ${active ? "text-magenta-700" : "text-tinta-suave"}`}>
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
