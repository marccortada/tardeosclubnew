"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck, Store, Megaphone, Disc3, UserRound } from "lucide-react";
import { cargarDatosCuenta } from "@/components/panel/CuentaNav";

export type Portal = { href: string; label: string; icono: LucideIcon };

const CUENTA: Portal = { href: "/perfil", label: "Mi cuenta", icono: UserRound };

/**
 * A qué portal lleva el botón de la cabecera con sesión: el mismo orden que
 * `rutaDeInicio` (lib/inicio.ts) —admin, local, DJ, cuenta—, pero con los
 * datos de cuenta en caché que ya comparten los paneles, para no repetir
 * consultas en cada página. `null` mientras se averigua (la cabecera pinta
 * el hueco); si falla, "Mi cuenta", que desde ahí se llega a todo.
 */
export function usePortal(uid: string | undefined): Portal | null {
  const [portal, setPortal] = useState<{ uid: string; p: Portal } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    cargarDatosCuenta(uid)
      .then((d) => {
        const p: Portal = d.esAdmin ? { href: "/admin", label: "Administración", icono: ShieldCheck }
          : d.ficha ? (d.ficha.tipo === "promotor"
            ? { href: "/local", label: "Mis eventos", icono: Megaphone }
            : { href: "/local", label: "Mi local", icono: Store })
          : d.esDj ? { href: "/dj", label: "Mi panel DJ", icono: Disc3 }
          : CUENTA;
        if (vivo) setPortal({ uid, p });
      })
      .catch(() => { if (vivo) setPortal({ uid, p: CUENTA }); });
    return () => { vivo = false; };
  }, [uid]);
  // Lo guardado es de otra cuenta (se cambió de sesión): aún no se sabe.
  return portal && portal.uid === uid ? portal.p : null;
}
