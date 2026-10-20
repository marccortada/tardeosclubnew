import { supabase } from "./supabase";
import { faltaLote } from "./encuestas";
import { mensajeAmable } from "./mensajeError";

/**
 * Sorteos (dossier 2.0 pág. 14, lote 67). Una participación por cuenta; la
 * ventana (abre/cierra) y el estado los valida la base al participar. El
 * ganador se ve solo por su alias y solo cuando el equipo lo publica.
 */

export type Sorteo = {
  id: string; titulo: string; descripcion: string | null; premio: string; bases: string | null; imagen_url: string | null;
  tardeo_id: string | null; zona_madre: string | null; abre: string; cierra: string;
  estado: "borrador" | "abierto" | "cerrado" | "resuelto"; ganador_alias: string | null; metodo: string | null; publicado_en: string | null;
};

// Columnas públicas (ganador_id y semilla NO tienen permiso de lectura: pedirlas da error).
export const COLS_SORTEO = "id,titulo,descripcion,premio,bases,imagen_url,tardeo_id,zona_madre,abre,cierra,estado,ganador_alias,metodo,publicado_en";

/** ¿Se puede participar AHORA? (la base lo vuelve a comprobar). */
export const abiertoAhora = (s: Pick<Sorteo, "estado" | "abre" | "cierra">, ahora = new Date()) =>
  s.estado === "abierto" && new Date(s.abre) <= ahora && ahora <= new Date(s.cierra);

export function etiquetaSorteo(s: Sorteo): string {
  if (s.estado === "resuelto") return "Ganador publicado";
  if (abiertoAhora(s)) return "Abierto";
  if (s.estado === "abierto" && new Date(s.abre) > new Date()) return "Próximamente";
  return "Cerrado";
}

export const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export async function participar(id: string): Promise<"registrada" | "ya_participabas"> {
  const { data, error } = await supabase.rpc("participar_sorteo", { p_sorteo: id });
  if (error) throw new Error(faltaLote(error) ? "Esta sección aún no está disponible." : mensajeAmable(error));
  return data as "registrada" | "ya_participabas";
}

export async function yaParticipo(id: string, uid: string): Promise<boolean> {
  const { data } = await supabase.from("sorteo_participaciones").select("id").eq("sorteo_id", id).eq("profile_id", uid).maybeSingle();
  return !!data;
}
