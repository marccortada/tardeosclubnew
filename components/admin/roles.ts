"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

/**
 * Permisos del admin por zona y tarea (lote 69).
 *
 * Solo sirve para PINTAR (qué menú, qué filtro por defecto). Lo que de verdad
 * protege son las políticas y funciones del lote 69 en la base: un admin de
 * Tarragona que se salte la pantalla sigue sin poder editar un local de
 * Barcelona.
 */
export type ZonaMadre = "barcelona" | "tarragona" | "girona";
export const ZONAS_MADRE: { clave: ZonaMadre; label: string }[] = [
  { clave: "barcelona", label: "Barcelona" },
  { clave: "tarragona", label: "Tarragona" },
  { clave: "girona", label: "Girona" },
];
export const TAREAS: { clave: string; label: string }[] = [
  { clave: "global", label: "Global (todo)" },
  { clave: "zona", label: "Zona" },
  { clave: "sorteos", label: "Sorteos" },
  { clave: "moderacion", label: "Moderación" },
  { clave: "comercial", label: "Comercial" },
  { clave: "nexo", label: "Nexo" },
];

export type PermisosAdmin = {
  cargando: boolean;
  /** true si el lote 69 aún no está: todo admin se comporta como global. */
  sinLote: boolean;
  global: boolean;
  /** null = todas las zonas. */
  zonas: ZonaMadre[] | null;
  /** Ficha de local/promotor propia (caso Sergi: local + admin de zona). */
  miLocal: { id: string; nombre: string } | null;
};

/** ¿Falta una función/tabla del lote? (42P01 tabla, 42883 función, PGRST202 RPC). */
export function faltaLote(e: unknown): boolean {
  const c = (e as { code?: string } | null)?.code;
  return c === "42P01" || c === "42883" || c === "PGRST202" || c === "PGRST205";
}

export function usePermisosAdmin(): PermisosAdmin {
  const { user } = useAuth();
  const [p, setP] = useState<PermisosAdmin>({ cargando: true, sinLote: false, global: false, zonas: [], miLocal: null });

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    Promise.all([
      supabase.rpc("es_admin_global"),
      supabase.rpc("mis_zonas_admin"),
      supabase.from("locales").select("id,nombre").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle(),
    ]).then(([g, z, l]) => {
      if (!vivo) return;
      const sinLote = faltaLote(g.error) || faltaLote(z.error);
      setP({
        cargando: false,
        sinLote,
        global: sinLote ? true : g.data === true,
        zonas: sinLote ? null : ((z.data as ZonaMadre[] | null) ?? null),
        miLocal: (l.data as { id: string; nombre: string } | null) ?? null,
      });
    });
    return () => { vivo = false; };
  }, [user]);

  return p;
}

/** Zonas (slug del catálogo) de una zona madre, para filtrar por `zona_slug`. */
export async function slugsDeZona(madre: ZonaMadre): Promise<string[]> {
  const { data } = await supabase.from("zonas").select("slug").eq("zona_madre", madre);
  return (data ?? []).map((z: { slug: string }) => z.slug);
}
