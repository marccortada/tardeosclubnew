"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { UserRound } from "lucide-react";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/tardeos", label: "Tardeos" },
  { href: "/colaboradores", label: "Colaboradores" },
  { href: "/mapa", label: "Mapa" },
  { href: "/favoritos", label: "Mis planes" },
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
          {loading ? (
            <span aria-hidden className="ml-2 h-[42px] w-[132px] rounded-full bg-black/5" />
          ) : user ? (
            <Link
              href="/perfil"
              className="ml-2 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-base font-extrabold text-tinta ring-1 ring-magenta-100 transition hover:ring-magenta active:scale-95"
            >
              <UserRound size={18} className="text-magenta" /> Mi cuenta
            </Link>
          ) : (
            <Link
              href="/perfil"
              className="ml-2 rounded-full bg-marca px-5 py-2.5 text-base font-extrabold text-white shadow-tarjeta transition hover:brightness-105 active:scale-95"
            >
              Entrar / Únete
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
