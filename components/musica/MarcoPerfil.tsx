"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver } from "@/lib/volver";

/**
 * Marco sencillo de las páginas de música dentro de Perfil (Mis DJs, Mis
 * sets): cabecera con volver a /perfil y título centrado, y la puerta de
 * "entra en tu cuenta" si no hay sesión.
 */
export default function MarcoPerfil({ titulo, ruta, children }: { titulo: string; ruta: string; children: (uid: string) => ReactNode }) {
  const { user, loading } = useAuth();
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-fondo pb-8">
      <div className="flex items-center gap-2 bg-superficie px-2 py-1">
        <Link href="/perfil" aria-label="Volver al perfil" className="grid h-12 w-12 place-items-center rounded-full hover:bg-fondo">
          <ArrowLeft size={22} aria-hidden />
        </Link>
        <h1 className="flex-1 text-center text-[19px] font-bold">{titulo}</h1>
        <span className="w-12" aria-hidden />
      </div>
      <div className="px-4 pt-4">
        {loading ? <p className="text-tinta-suave">Cargando…</p>
          : !user ? (
            <div className="pt-10 text-center">
              <p className="text-[17px] font-semibold">Entra en tu cuenta para verlo.</p>
              <Link href={entrarYVolver(ruta)} className="mt-4 inline-flex min-h-tacto items-center rounded-xl bg-magenta px-6 font-bold text-white">Entrar</Link>
            </div>
          ) : children(user.id)}
      </div>
    </main>
  );
}
