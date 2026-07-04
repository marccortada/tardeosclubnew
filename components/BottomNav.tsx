"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Disc3, MapPin, Heart, User } from "lucide-react";

const tabs = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/tardeos", label: "Tardeos", icon: CalendarDays },
  { href: "/djs", label: "DJs", icon: Disc3 },
  { href: "/mapa", label: "Mapa", icon: MapPin },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
  { href: "/perfil", label: "Perfil", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-magenta-100 bg-white md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              <Icon
                size={24}
                strokeWidth={active ? 2.6 : 2}
                className={active ? "text-magenta" : "text-tinta/50"}
              />
              <span
                className={`text-[11px] font-bold ${
                  active ? "text-magenta" : "text-tinta/50"
                }`}
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
