"use client";

import { supabase } from "./supabase";

/**
 * Solicitudes de mensaje al DJ y conversaciones (lote 66, dossier pág. 8).
 * Tardícola → DJ: un primer mensaje; el DJ acepta, rechaza, bloquea o pausa.
 * No hay privados entre tardícolas. Límites y filtro de teléfonos/emails los
 * aplica la base (enviar_solicitud_dj, políticas y disparadores).
 */

export type Solicitud = {
  id: string;
  de: string;
  dj_id: string;
  texto: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  respondida_en: string | null;
  created_at: string;
  djs?: { nombre_artistico: string; avatar_url: string | null } | null;
};

export type MensajeDj = {
  id: string;
  conversacion: string;
  autor: string;
  texto: string;
  retenido: boolean;
  created_at: string;
};

export const COLS_SOLICITUD = "id,de,dj_id,texto,estado,respondida_en,created_at,djs(nombre_artistico,avatar_url)";

export async function enviarSolicitud(djId: string, texto: string) {
  const { data, error } = await supabase.rpc("enviar_solicitud_dj", { p_dj: djId, p_texto: texto.trim() });
  return { id: (data as string | null) ?? null, error };
}

export async function responderSolicitud(id: string, accion: "aceptar" | "rechazar" | "bloquear" | "desbloquear") {
  const { error } = await supabase.rpc("responder_solicitud_dj", { p_solicitud: id, p_accion: accion });
  return { error };
}

export async function limitarSolicitudes(djId: string, acepta: boolean) {
  const { error } = await supabase.rpc("limitar_solicitudes_dj", { p_dj: djId, p_acepta: acepta });
  return { error };
}

export async function mensajesDe(conversacion: string) {
  const { data, error } = await supabase.from("mensajes_dj")
    .select("id,conversacion,autor,texto,retenido,created_at")
    .eq("conversacion", conversacion).order("created_at", { ascending: false }).limit(200);
  return { mensajes: ((data as MensajeDj[] | null) ?? []).reverse(), error };
}

export async function enviarMensajeDj(conversacion: string, texto: string) {
  const { data, error } = await supabase.from("mensajes_dj")
    .insert({ conversacion, texto: texto.trim() })
    .select("id,conversacion,autor,texto,retenido,created_at").single();
  return { mensaje: data as MensajeDj | null, error };
}

export const ESTADO_SOLICITUD: Record<Solicitud["estado"], string> = {
  pendiente: "Pendiente", aceptada: "Aceptada", rechazada: "No aceptada",
};
