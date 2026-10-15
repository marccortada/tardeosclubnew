"use client";

import { supabase } from "./supabase";

/**
 * Entre Beats (lote 66): hilos y anuncios SOLO para profesionales (DJ, local,
 * promotor, admin). La base no devuelve nada a un tardícola aunque llame a la
 * API a mano: las políticas usan private.es_profesional().
 */

export type Hilo = {
  id: string; autor: string; titulo: string; cuerpo: string; tema: string | null; zona: string | null;
  retenido: boolean; created_at: string; eb_respuestas?: { count: number }[];
};
export type Respuesta = { id: string; hilo_id: string; autor: string; cuerpo: string; retenido: boolean; created_at: string };
export type Anuncio = {
  id: string; autor: string; categoria: string; titulo: string; cuerpo: string; zona: string | null;
  estilos: string[]; contacto: string; estado: "abierto" | "cerrado"; retenido: boolean; created_at: string;
};
export type Autor = { id: string; nombre: string; rol: string; dj_id: string | null };

export const CATEGORIAS = [
  { k: "busco_dj", label: "Busco DJ" },
  { k: "busco_local", label: "Busco local" },
  { k: "colaboracion", label: "Colaboración" },
  { k: "material", label: "Material / equipo" },
  { k: "otro", label: "Otro" },
] as const;

export const TEMAS = ["Música", "Eventos", "Press kit", "Promoción", "Equipo", "Otro"];

/**
 * Texto del buscador → consulta de texto completo en español con prefijos
 * ("prep" encuentra "preparar"). Solo letras y números: así ninguna entrada
 * rompe la sintaxis de to_tsquery.
 */
export function consultaBusqueda(q: string): string | null {
  const palabras = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (palabras.length === 0) return null;
  return palabras.slice(0, 6).map((p) => `${p}:*`).join(" & ");
}

export async function autores(ids: string[]): Promise<Record<string, Autor>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return {};
  const { data } = await supabase.rpc("eb_autores", { p_ids: unicos });
  const m: Record<string, Autor> = {};
  for (const a of (data as Autor[] | null) ?? []) m[a.id] = a;
  return m;
}
