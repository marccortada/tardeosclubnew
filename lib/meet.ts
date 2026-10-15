"use client";

import { supabase } from "./supabase";

/**
 * Meet Zone (lote 66): chat de cada evento. Quién entra, cuándo cierra y qué
 * se puede publicar lo decide la BASE (meet_estado, políticas y disparador);
 * aquí solo se pinta. Ocultar un botón no es seguridad.
 */

export type AccesoMeet =
  | "no_sesion" | "no_existe" | "organizador" | "admin" | "participante"
  | "espera" | "no_confirmado" | "cerrado";

export type EstadoMeet = {
  acceso: AccesoMeet;
  puede_escribir?: boolean;
  cierra_en?: string;
  titulo?: string;
  fecha?: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  estado_evento?: string;
  organizador?: string | null;
  participantes?: number;
  fijado?: string | null;
};

export type MensajeMeet = {
  id: string;
  tardeo_id: string;
  autor: string;
  texto: string;
  retenido: boolean;
  created_at: string;
};

export type PerfilPublico = { id: string; alias: string; avatar_url: string | null; bio: string | null };

/** Error de Supabase → frase para la persona. Detecta si falta el lote. */
export function textoError(e: unknown, lote = "66"): string {
  const err = (e ?? {}) as { code?: string; message?: string; hint?: string };
  if (["42P01", "42883", "PGRST202", "PGRST205", "PGRST200"].includes(err.code ?? "")) {
    return `Esta sección aún no está activada (falta el lote ${lote} en la base).`;
  }
  if (err.code === "42501" || /row-level security/i.test(err.message ?? "")) {
    return "No tienes permiso para hacer esto ahora mismo.";
  }
  return err.message || "Algo ha fallado. Vuelve a intentarlo.";
}

export function faltaLote(e: unknown): boolean {
  const c = (e as { code?: string } | null)?.code ?? "";
  return ["42P01", "42883", "PGRST202", "PGRST205", "PGRST200"].includes(c);
}

export async function estadoMeet(tardeoId: string) {
  const { data, error } = await supabase.rpc("meet_estado", { p_tardeo: tardeoId });
  return { estado: (data as EstadoMeet | null) ?? null, error };
}

export async function mensajesMeet(tardeoId: string) {
  // Las 200 últimas: un chat de evento vivo 72 h no pasa de ahí en la práctica.
  const { data, error } = await supabase.from("meet_mensajes")
    .select("id,tardeo_id,autor,texto,retenido,created_at")
    .eq("tardeo_id", tardeoId).order("created_at", { ascending: false }).limit(200);
  return { mensajes: ((data as MensajeMeet[] | null) ?? []).reverse(), error };
}

export async function enviarMeet(tardeoId: string, texto: string) {
  const { data, error } = await supabase.from("meet_mensajes")
    .insert({ tardeo_id: tardeoId, texto: texto.trim() })
    .select("id,tardeo_id,autor,texto,retenido,created_at").single();
  return { mensaje: data as MensajeMeet | null, error };
}

export async function fijarMeet(tardeoId: string, texto: string) {
  const { error } = await supabase.rpc("meet_fijar", { p_tardeo: tardeoId, p_texto: texto });
  return { error };
}

/** Alias, foto y presentación (nunca email ni teléfono: lote 63). */
export async function perfilesPublicos(ids: string[]): Promise<Record<string, PerfilPublico>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.rpc("perfil_publico", { p_ids: ids });
  const mapa: Record<string, PerfilPublico> = {};
  for (const p of (data as PerfilPublico[] | null) ?? []) mapa[p.id] = p;
  return mapa;
}

/** Mismo criterio que el servidor, para avisar ANTES de enviar. El que manda es el servidor. */
export function pareceContacto(t: string): boolean {
  if (/[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\sarroba\s)\s*[a-z0-9-]+(\.|\s*punto\s*)[a-z]{2,}/i.test(t)) return true;
  const sin = t.replace(/[\s.\-()/]/g, "");
  return /\d{9,}/.test(sin) || /(\+|00)\d{8,}/.test(sin);
}

export function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" });
}
