import { supabase } from "./supabase";
import type { Segmentacion } from "@/components/SegmentadorPopup";

export type Campana = {
  id: string;
  local_id: string;
  titulo: string;
  mensaje: string | null;
  tipo: string;
  seg_musica: string[] | null;
  seg_tipos_evento: string[] | null;
  seg_edades: string[] | null;
  seg_zonas: string[] | null;
  desde: string | null;
  hasta: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  popup_id: string | null;
  nota_admin: string | null;
  created_at: string;
  revisada_at: string | null;
  locales?: { nombre: string; tipo: string | null } | null;
};

const vaciarONull = (v: string[]) => (v.length ? v : null);

/** Pide una campaña. Nace en 'pendiente': no se publica sola. */
export async function pedirCampana(
  localId: string,
  datos: { titulo: string; mensaje: string; tipo: string; desde?: string | null; hasta?: string | null },
  seg: Segmentacion
) {
  return supabase.from("campanas").insert({
    local_id: localId,
    titulo: datos.titulo.trim(),
    mensaje: datos.mensaje.trim() || null,
    tipo: datos.tipo,
    desde: datos.desde || null,
    hasta: datos.hasta || null,
    seg_musica: vaciarONull(seg.musica),
    seg_tipos_evento: vaciarONull(seg.tiposEvento),
    seg_edades: vaciarONull(seg.edades),
    seg_zonas: vaciarONull(seg.zonas),
  }).select("id");
}

/** Las campañas de un local, la última primero. */
export async function getCampanasDeLocal(localId: string): Promise<Campana[]> {
  const { data, error } = await supabase
    .from("campanas").select("*").eq("local_id", localId)
    .order("created_at", { ascending: false });
  if (error) console.error("[campanas] no se pudieron cargar las tuyas:", error.message);
  return (data as Campana[]) ?? [];
}

/** Todas, para el admin. Con el nombre del local, que si no son uuids sueltos. */
export async function getCampanas(estado?: string): Promise<Campana[]> {
  let q = supabase.from("campanas").select("*, locales(nombre,tipo)").order("created_at", { ascending: false });
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) console.error("[campanas] no se pudieron cargar:", error.message);
  return (data as Campana[]) ?? [];
}

/**
 * Aprobar: nace el pop-up y la campaña queda ligada a él.
 *
 * El pop-up se crea primero y la campaña se marca después. Si fallara al
 * revés, quedaría una campaña "aprobada" sin nada que enseñar, y nadie se
 * enteraría hasta que el local preguntara por qué no sale.
 */
export async function aprobarCampana(c: Campana) {
  const { data: popup, error: e1 } = await supabase.from("popups").insert({
    titulo: c.titulo,
    mensaje: c.mensaje,
    tipo: c.tipo,
    activo: true,
    // Segmentado por gustos, así que solo tiene sentido para quien tiene
    // cuenta: sin ADN no hay nada con lo que cruzar.
    publico: "registrados",
    seg_musica: c.seg_musica,
    seg_tipos_evento: c.seg_tipos_evento,
    seg_edades: c.seg_edades,
    seg_zonas: c.seg_zonas,
    desde: c.desde,
    hasta: c.hasta,
  }).select("id").single();
  if (e1) return { error: e1 };

  const { error: e2 } = await supabase.from("campanas")
    .update({ estado: "aprobada", popup_id: popup.id, revisada_at: new Date().toISOString() })
    .eq("id", c.id);
  // Si esto falla, el pop-up ya está vivo pero la campaña sigue pendiente. Se
  // deshace el pop-up para no dejar un anuncio suelto que nadie sabe de quién es.
  if (e2) { await supabase.from("popups").delete().eq("id", popup.id); return { error: e2 }; }
  return { error: null };
}

/** Rechazar, con motivo: sin él el local no sabe qué corregir. */
export async function rechazarCampana(id: string, nota: string) {
  return supabase.from("campanas")
    .update({ estado: "rechazada", nota_admin: nota.trim() || null, revisada_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Cuánta gente encaja con el segmento.
 *
 * Devuelve 0 cuando son menos de cinco: no es un error, es que la base no
 * quiere servir de buscador de personas. Quien llama debe decir "menos de 5"
 * y no "ninguno", que son cosas distintas.
 */
export async function alcanceEstimado(seg: Segmentacion): Promise<number | null> {
  const { data, error } = await supabase.rpc("alcance_estimado", {
    p_musica: vaciarONull(seg.musica),
    p_tipos: vaciarONull(seg.tiposEvento),
    p_edades: vaciarONull(seg.edades),
    p_zonas: vaciarONull(seg.zonas),
  });
  if (error) { console.error("[campanas] alcance:", error.message); return null; }
  return Number(data ?? 0);
}
