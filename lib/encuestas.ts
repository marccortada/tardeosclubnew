import { supabase } from "./supabase";
import { mensajeAmable } from "./mensajeError";

/**
 * Encuesta "¿Qué tal el tardeo?" (dossier 2.0 pág. 10, lote 67).
 * Quién puede responder y hasta cuándo lo decide la BASE (estado_encuesta /
 * responder_encuesta): la pantalla solo enseña el resultado.
 */

export const OPC_MUSICA = ["House", "Disco", "Remember", "Pop", "Latino", "Flamenco", "Rock", "Comercial"];
export const OPC_AMBIENTE = ["Social", "Chill", "Festivo", "Elegante", "Familiar"];
export const OPC_ROPA = ["Casual", "Arreglado", "Elegante", "Playero"];
export const OPC_EDAD = ["25–35", "35–45", "45–55", "55+"];

export type EstadoEncuesta =
  | "ok" | "sin_sesion" | "no_existe" | "cancelado" | "no_confirmado" | "aun_no" | "fuera_plazo" | "ya_respondida" | "falta_lote";

export type RespuestaEncuesta = {
  valoracion: number; musica: string[]; ambiente: string[]; ropa: string | null; edad: string | null;
  volverias: "si" | "no" | "nose" | null; comentario: string;
};

/** ¿Falta el lote 67? (tabla/función inexistente o no publicada en la API). */
export function faltaLote(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return ["42P01", "42883", "PGRST202", "PGRST205"].includes(e.code ?? "") || /does not exist|Could not find/i.test(e.message ?? "");
}

export async function estadoEncuesta(tardeoId: string): Promise<EstadoEncuesta> {
  const { data, error } = await supabase.rpc("estado_encuesta", { p_tardeo: tardeoId });
  if (error) {
    if (faltaLote(error)) return "falta_lote";
    throw new Error(error.message);
  }
  return data as EstadoEncuesta;
}

export async function enviarEncuesta(tardeoId: string, r: RespuestaEncuesta): Promise<void> {
  const { error } = await supabase.rpc("responder_encuesta", {
    p_tardeo: tardeoId, p_valoracion: r.valoracion, p_musica: r.musica, p_ambiente: r.ambiente,
    p_ropa: r.ropa, p_edad: r.edad, p_volverias: r.volverias, p_comentario: r.comentario.trim() || null,
  });
  if (error) throw new Error(faltaLote(error) ? "Esta sección aún no está disponible." : mensajeAmable(error));
}

export type ValoracionPublica = { valoracion: number; comentario: string | null; alias: string; tardeo_id: string; created_at: string };

/** Lo público: solo nota y comentario (por tardeo o por local). */
export async function valoracionesPublicas(f: { tardeo?: string; local?: string }, limite = 20): Promise<ValoracionPublica[]> {
  const { data, error } = await supabase.rpc("valoraciones_publicas", { p_tardeo: f.tardeo ?? null, p_local: f.local ?? null, p_limite: limite });
  if (error) return [];
  return (data ?? []) as ValoracionPublica[];
}
