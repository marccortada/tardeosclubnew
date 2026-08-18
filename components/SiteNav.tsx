"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { User } from "lucide-react";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/tardeos", label: "Tardeos" },
  { href: "/colaboradores", label: "Colaboradores" },
  { href: "/mapa", label: "Mapa" },
  { href: "/favoritos", label: "Favoritos" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-[900] hidden border-b border-black/5 bg-white/85 backdrop-blur-md md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-3">
        <Link href="/">
          <Image src="/branding/logo-transp.png" alt="TardeosClub" width={150} height={90} priority className="h-12 w-auto" />
        </Link>

        <nav className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-5 py-2 text-base font-extrabold transition ${
                  active ? "bg-magenta-50 text-magenta" : "text-tinta/70 hover:bg-black/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <Link
            href="/perfil"
            className="ml-2 rounded-full bg-marca px-5 py-2.5 text-base font-extrabold text-white shadow-tarjeta transition hover:brightness-105 active:scale-95"
          >
            Entrar / Únete
          </Link>
        </nav>
      </div>
    </header>
  );
}
