"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { claseCampo } from "@/components/ui/Campo";
import { faltaLote, usePermisosAdmin, ZONAS_MADRE, type ZonaMadre } from "@/components/admin/roles";

/**
 * Filtro de zona de las listas del admin (locales, promotores, tardeos,
 * registro), sobre la columna `zona_slug` del lote 69.
 *
 * Solo decide QUÉ SE VE. Quién puede cambiar qué lo deciden las políticas del
 * lote 69: un admin de Tarragona que elija "Todas" ve Barcelona, pero la base
 * le sigue diciendo que no si intenta tocarla. Por eso aquí además se marca
 * cada fila como "solo lectura" (para no ofrecer botones que van a fallar).
 *
 * "Mi zona" = sus zonas madre MÁS lo que no tiene zona, igual que
 * `cola_trabajo()`: lo sin zona no es de nadie y, si no lo ve el admin de
 * zona, solo lo vería el global y se quedaría sin revisar.
 *
 * Degradación: sin el lote 69 (no hay `mis_zonas_admin` o no existe la
 * columna `zona_slug`) no se filtra nada y no se pinta el selector: la
 * pantalla queda exactamente como antes.
 */
export type ClaveZona = "mia" | "todas" | "sin_zona" | ZonaMadre;

/** Lo mínimo de una consulta de Supabase que usa el filtro (el tipo real es demasiado profundo). */
type ConZona = {
  in(c: string, v: string[]): ConZona;
  is(c: string, v: null): ConZona;
  or(f: string, o?: { referencedTable?: string }): ConZona;
};

/** ¿Falta la columna? 42703 (Postgres) o PGRST204 (caché de PostgREST). */
export const faltaColumna = (e: unknown) => {
  const c = (e as { code?: string } | null)?.code;
  return c === "42703" || c === "PGRST204";
};

type Catalogo = { madre: Map<string, ZonaMadre>; columna: boolean };
const SIN_LOTE: Catalogo = { madre: new Map(), columna: false };

export type FiltroZona = {
  /** false mientras se leen permisos y catálogo: no consultar aún (evita enseñar todo un instante a un admin de zona). */
  listo: boolean;
  /** true si la base tiene el lote 69 y se puede filtrar por zona. */
  activo: boolean;
  valor: ClaveZona;
  setValor: (v: ClaveZona) => void;
  opciones: { clave: ClaveZona; label: string }[];
  /** true si el admin es global (ve y toca todo). */
  global: boolean;
  /** Para meter en las dependencias de `usePaginado` y de los contadores. */
  clave: string;
  /** ¿Filtra algo la opción elegida? (la lista de inscripciones necesita `!inner` solo entonces). */
  filtra: boolean;
  /**
   * Pone el filtro en una consulta. `tabla` = nombre de la tabla embebida si
   * la columna no es de la tabla principal (p. ej. "tardeos" desde
   * inscripciones; ahí la embebida tiene que ir con `!inner`).
   */
  aplicar: <Q>(q: Q, tabla?: string) => Q;
  /** ¿Puede este admin cambiar una fila con esa zona? Misma regla que `admin_de_slug()`. */
  puedeEditar: (slug: string | null | undefined) => boolean;
};

export function useFiltroZona(): FiltroZona {
  const permisos = usePermisosAdmin();
  // slug → zona madre del catálogo (lote 63) y si existe la columna zona_slug.
  const [leido, setLeido] = useState<Catalogo | null>(null);
  const [elegido, setElegido] = useState<ClaveZona | null>(null);

  useEffect(() => {
    // Sin las funciones del lote 69 no hay nada que leer: todo admin es global.
    if (permisos.cargando || permisos.sinLote) return;
    let vivo = true;
    Promise.all([
      supabase.from("zonas").select("slug,zona_madre"),
      // Sonda barata: una fila, una columna. Distingue "lote 69 a medias".
      supabase.from("tardeos").select("zona_slug").limit(1),
    ]).then(([z, c]) => {
      if (!vivo) return;
      const madre = new Map<string, ZonaMadre>();
      (z.data ?? []).forEach((x: { slug: string; zona_madre: ZonaMadre }) => madre.set(x.slug, x.zona_madre));
      const columna = !z.error && !(c.error && (faltaColumna(c.error) || faltaLote(c.error)));
      setLeido({ madre, columna });
    });
    return () => { vivo = false; };
  }, [permisos.cargando, permisos.sinLote]);

  const catalogo = permisos.sinLote ? SIN_LOTE : leido;
  // zonas === null = todas (global, o rol de zona sin zona concreta).
  const global = permisos.global || permisos.zonas === null;
  const mias = useMemo(() => permisos.zonas ?? [], [permisos.zonas]);
  const listo = !permisos.cargando && catalogo !== null;
  const activo = listo && catalogo.columna;

  const slugsDe = (madres: ZonaMadre[]) =>
    [...(catalogo?.madre.entries() ?? [])].filter(([, m]) => madres.includes(m)).map(([s]) => s);

  const opciones: { clave: ClaveZona; label: string }[] = global
    ? [{ clave: "todas", label: "Todas" }, ...ZONAS_MADRE.map((z) => ({ clave: z.clave, label: z.label })), { clave: "sin_zona", label: "Sin zona" }]
    : [
        {
          clave: "mia",
          label: mias.length
            ? `Mi zona (${mias.map((m) => ZONAS_MADRE.find((z) => z.clave === m)?.label ?? m).join(", ")} y sin zona)`
            : "Mi zona (solo lo que no tiene zona)",
        },
        { clave: "todas", label: "Todas (solo lectura fuera de tu zona)" },
      ];

  // Por defecto: el global ve todo; el de zona, lo suyo.
  const valor: ClaveZona = !activo ? "todas" : elegido && opciones.some((o) => o.clave === elegido) ? elegido : global ? "todas" : "mia";

  const aplicar = <Q,>(consulta: Q, tabla?: string): Q => {
    if (!activo || valor === "todas") return consulta;
    const q = consulta as unknown as ConZona;
    const col = tabla ? `${tabla}.zona_slug` : "zona_slug";
    if (valor === "sin_zona") return q.is(col, null) as unknown as Q;
    if (valor === "mia") {
      const s = slugsDe(mias);
      // Los slugs son [a-z-]: no rompen la sintaxis de `or`.
      const f = s.length ? `zona_slug.in.(${s.join(",")}),zona_slug.is.null` : "zona_slug.is.null";
      return q.or(f, tabla ? { referencedTable: tabla } : undefined) as unknown as Q;
    }
    return q.in(col, slugsDe([valor])) as unknown as Q;
  };

  const puedeEditar = (slug: string | null | undefined) => {
    if (!activo || permisos.global) return true;
    // Lo sin zona solo lo toca el global (`admin_de_slug(null)` = false).
    if (!slug) return false;
    const m = catalogo?.madre.get(slug);
    return permisos.zonas === null || (!!m && mias.includes(m));
  };

  return {
    listo, activo, valor, setValor: setElegido, opciones, global: permisos.global,
    clave: `${listo}|${activo}|${valor}`, filtra: activo && valor !== "todas", aplicar, puedeEditar,
  };
}

/** Promesa que no se resuelve: deja la lista en "Cargando…" hasta que el filtro esté listo. */
export const esperar = <T,>() => new Promise<T>(() => {});

/** Selector "Zona: …". No se pinta si no hay lote 69 (no hay por qué filtrar). */
export function SelectorZona({ zona }: { zona: FiltroZona }) {
  if (!zona.activo) return null;
  return (
    <label className="flex flex-col gap-1 text-[15px] font-semibold sm:flex-row sm:items-center sm:gap-2">
      <span className="shrink-0">Zona:</span>
      <select value={zona.valor} onChange={(e) => zona.setValor(e.target.value as ClaveZona)}
        className={`${claseCampo} !min-h-[44px] !py-2 sm:w-auto`} aria-label="Zona">
        {zona.opciones.map((o) => <option key={o.clave} value={o.clave}>{o.label}</option>)}
      </select>
    </label>
  );
}
