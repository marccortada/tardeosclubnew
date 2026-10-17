"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { cargarDatosCuenta } from "@/components/panel/CuentaNav";

/**
 * Qué es la persona con sesión, en un solo sitio.
 *
 * El dossier 2.0 separa dos experiencias: TARDÍCOLA (público) y PROFESIONAL
 * (DJ, local u organizador). La barra de abajo, Entre Beats y el press kit
 * dependen de esto. Es solo para pintar: lo que de verdad protege es la base
 * (RLS, función `private.es_profesional()` del lote 63). Ocultar un botón no
 * es seguridad.
 */
export type Roles = {
  cargando: boolean;
  conSesion: boolean;
  esAdmin: boolean;
  esLocal: boolean;
  esPromotor: boolean;
  esDj: boolean;
  /** DJ, local, promotor o admin: ve Entre Beats y press kits. */
  esProfesional: boolean;
};

const VACIO: Roles = {
  cargando: false, conSesion: false, esAdmin: false, esLocal: false,
  esPromotor: false, esDj: false, esProfesional: false,
};

export function useRoles(): Roles {
  const { user, loading } = useAuth();
  const [roles, setRoles] = useState<{ uid: string; r: Roles } | null>(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    // «Profesional» lo decide la BASE (`es_profesional()`, lote 73: admin, local
    // ACTIVO o DJ no oculto), no una copia de la regla aquí: si no coinciden, la
    // pestaña Entre Beats aparece y luego la base deniega todo lo de dentro.
    // Si la función no responde (sin lote), la regla de antes.
    Promise.all([
      cargarDatosCuenta(user.id),
      supabase.rpc("es_profesional").then(({ data, error }) => (error ? null : Boolean(data)), () => null),
    ])
      .then(([d, prof]) => {
        const esLocal = d.ficha?.tipo === "local";
        const esPromotor = d.ficha?.tipo === "promotor";
        const r: Roles = {
          cargando: false, conSesion: true, esAdmin: d.esAdmin, esLocal, esPromotor, esDj: d.esDj,
          esProfesional: prof ?? (d.esAdmin || esLocal || esPromotor || d.esDj),
        };
        if (vivo) setRoles({ uid: user.id, r });
      })
      .catch(() => { if (vivo) setRoles({ uid: user.id, r: { ...VACIO, conSesion: true } }); });
    return () => { vivo = false; };
  }, [user]);

  if (loading) return { ...VACIO, cargando: true };
  if (!user) return VACIO;
  if (!roles || roles.uid !== user.id) return { ...VACIO, conSesion: true, cargando: true };
  return roles.r;
}
