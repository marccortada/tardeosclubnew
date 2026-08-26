"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { Home, CalendarDays, MapPin, Heart, User, Store, Megaphone, Handshake } from "lucide-react";

const BASE = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/tardeos", label: "Tardeos", icon: CalendarDays },
  { href: "/colaboradores", label: "Colaboradores", icon: Handshake },
  { href: "/mapa", label: "Mapa", icon: MapPin },
  { href: "/favoritos", label: "Mis planes", icon: Heart },
  { href: "/perfil", label: "Perfil", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [ficha, setFicha] = useState<"local" | "promotor" | null>(null);

  // La pestaña de local/promotor solo aparece a quien tiene ficha: para un
  // tardícola normal sería un enlace a una página que le dice que no tiene nada.
  useEffect(() => {
    if (!user) { setFicha(null); return; }
    supabase.from("locales").select("tipo").eq("owner_id", user.id).limit(1).maybeSingle()
      .then(({ data }) => setFicha(data ? (data.tipo === "promotor" ? "promotor" : "local") : null));
  }, [user]);

  // A quien tiene ficha se le añade su panel antes de Favoritos, sin quitar
  // nada. Son siete pestañas: caben, pero justas, por eso los tamaños de abajo
  // se ajustan cuando aparece la séptima.
  const tabs = ficha
    ? [
        ...BASE.slice(0, 4),
        {
          href: "/local",
          label: ficha === "promotor" ? "Promo" : "Local",
          icon: ficha === "promotor" ? Megaphone : Store,
        },
        ...BASE.slice(4),
      ]
    : BASE;
  const apretado = tabs.length > 6;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-magenta-100 bg-white md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 ${apretado ? "px-0.5 py-2" : "py-2.5"}`}
            >
              <Icon
                size={apretado ? 21 : 24}
                strokeWidth={active ? 2.6 : 2}
                className={active ? "text-magenta" : "text-tinta/50"}
              />
              {/* "Colaboradores" no cabe al tamaño normal. En vez de inventar
                  una abreviatura que se lea raro, la etiqueta larga se encoge. */}
              <span
                className={`w-full truncate text-center font-bold ${
                  label.length > 9 ? "text-[9px]" : apretado ? "text-[10px]" : "text-[11px]"
                } ${active ? "text-magenta" : "text-tinta/50"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
