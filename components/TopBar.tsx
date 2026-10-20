"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { claseEntrar } from "@/components/SiteNav";
import { usePortal } from "@/components/cuenta/usePortal";
import { MARCA } from "@/lib/marca";

/**
 * Cabecera de la portada en el móvil (en escritorio manda SiteNav).
 * Con sesión no invita a "Entrar": lleva al portal de cada cuenta.
 */
export default function TopBar() {
  const { user, loading } = useAuth();
  const portal = usePortal(user?.id);
  return (
    <div className="sticky top-0 z-[800] flex h-16 items-center justify-between border-b border-linea bg-white/95 px-4 backdrop-blur">
      {/* Logo redondo, igual que en la cabecera de escritorio. */}
      <Link href="/" aria-label={`${MARCA.nombre}, inicio`}>
        <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-linea bg-white shadow-tarjeta">
          <Image src="/branding/logo-transp.png" alt={MARCA.nombre} width={120} height={70} priority className="h-auto w-10" />
        </span>
      </Link>
      {loading || (user && !portal) ? (
        <span aria-hidden className="h-11 w-32 rounded-[14px] bg-marfil-100" />
      ) : user && portal ? (
        <Link href={portal.href} className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border border-linea-fuerte bg-white px-4 text-[15px] font-bold text-tinta transition active:scale-95">
          <portal.icono size={19} aria-hidden /> {portal.label}
        </Link>
      ) : (
        // El mismo botón que en escritorio (SiteNav).
        <Link href="/perfil" className={claseEntrar}>
          Entrar / Únete
        </Link>
      )}
    </div>
  );
}
