import { supabase } from "./supabase";
import { Tardeo } from "./types";
import { TARDEOS, getTardeo } from "./mockData";

const SELECT = "*, locales(*), tardeo_djs(djs(*))";

function mapRow(r: any): Tardeo {
  const loc = r.locales ?? {};
  return {
    id: r.id,
    titulo: r.titulo,
    local: {
      id: loc.id ?? r.local_id,
      nombre: loc.nombre ?? "",
      zona: loc.zona ?? r.zona ?? "",
      direccion: loc.direccion ?? r.direccion ?? "",
      verificado: loc.verificado ?? false,
    },
    djs: (r.tardeo_djs ?? []).map((td: any) => ({
      id: td.djs?.id,
      nombre: td.djs?.nombre_artistico ?? "",
      estilos: td.djs?.estilos ?? [],
      verificado: td.djs?.verificado ?? false,
      reputacion: Number(td.djs?.reputacion_score ?? 0),
      avatar: td.djs?.avatar_url ?? undefined,
    })),
    fecha: r.fecha,
    horaInicio: (r.hora_inicio ?? "").slice(0, 5),
    horaFin: (r.hora_fin ?? "").slice(0, 5),
    zona: r.zona ?? loc.zona ?? "",
    estilo: r.estilo ?? "",
    tipoEntrada: r.tiene_lista ? "lista" : r.es_de_pago ? "pago" : "gratis",
    precio: r.precio != null ? Number(r.precio) : undefined,
    destacado: r.destacado_hasta ? new Date(r.destacado_hasta) > new Date() : false,
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    flyer: r.flyer_url ?? undefined,
    flyerFrom: "#E10A5A",
    flyerTo: "#F5B301",
  };
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de España. */
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

/**
 * Tardeos publicados y NO expirados (fecha de hoy en adelante).
 * Un tardeo cuya fecha ya pasó no se muestra (ni en mapa, ni home, ni listado).
 * Si la BBDD está vacía o falla, usa el mock (transición).
 */
export async function getTardeosPublicados(): Promise<Tardeo[]> {
  const hoy = hoyISO();
  try {
    const { data, error } = await supabase
      .from("tardeos")
      .select(SELECT)
      .eq("estado", "publicado")
      .gte("fecha", hoy)
      .order("fecha", { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) return data.map(mapRow);
  } catch (e) {
    console.error("[tardeos] Supabase no disponible, uso mock:", e);
  }
  return TARDEOS.filter((t) => t.fecha >= hoy);
}

/** Un local por id (para su página pública). */
export async function getLocalById(id: string): Promise<any | null> {
  const { data } = await supabase.from("locales").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/** Tardeos publicados y no expirados de un local (para su página pública). */
export async function getTardeosPublicadosDeLocal(localId: string): Promise<Tardeo[]> {
  const hoy = hoyISO();
  const { data } = await supabase
    .from("tardeos")
    .select(SELECT)
    .eq("local_id", localId)
    .eq("estado", "publicado")
    .gte("fecha", hoy)
    .order("fecha", { ascending: true });
  return (data ?? []).map(mapRow);
}

/** Actualiza campos del local (fotos, descripción, teléfono…). */
export async function updateMiLocal(id: string, fields: Record<string, unknown>) {
  return supabase.from("locales").update(fields).eq("id", id);
}

/** Sube una foto del local al Storage y devuelve la URL pública. */
export async function subirFotoLocal(id: string, file: File): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ruta = `locales/${id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("flyers").upload(ruta, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) return null;
  return supabase.storage.from("flyers").getPublicUrl(ruta).data.publicUrl;
}

/** El primer local del usuario (owner). Devuelve la fila cruda o null. */
export async function getMiLocal(ownerId: string): Promise<any | null> {
  const { data } = await supabase
    .from("locales").select("*").eq("owner_id", ownerId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  return data ?? null;
}

/** Métricas de un local (visitas totales + inscritos activos). Requiere Lote 5. */
export async function getMetricasLocal(localId: string): Promise<{ visitas: number; inscritos: number }> {
  try {
    const { data, error } = await supabase.rpc("metricas_de_local", { p_local: localId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { visitas: Number(row?.visitas ?? 0), inscritos: Number(row?.inscritos ?? 0) };
  } catch {
    return { visitas: 0, inscritos: 0 };
  }
}

/** El perfil DJ del usuario (si lo tiene). */
export async function getMiDj(profileId: string): Promise<any | null> {
  const { data } = await supabase
    .from("djs").select("*").eq("profile_id", profileId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  return data ?? null;
}

/** Lista pública de DJs (no ocultos), ordenados por reputación. */
export async function getDjsPublicos(): Promise<any[]> {
  const { data } = await supabase
    .from("djs")
    .select("id,nombre_artistico,estilos,avatar_url,verificado,reputacion_score")
    .eq("oculto", false)
    .order("verificado", { ascending: false })
    .order("reputacion_score", { ascending: false });
  return data ?? [];
}

/** Un DJ por id (para su página pública). */
export async function getDjById(id: string): Promise<any | null> {
  const { data } = await supabase.from("djs").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/** Tardeos publicados y no expirados en los que pincha un DJ. */
export async function getTardeosPublicadosDeDj(djId: string): Promise<Tardeo[]> {
  const hoy = hoyISO();
  const { data } = await supabase
    .from("tardeo_djs")
    .select(`tardeos(${SELECT})`)
    .eq("dj_id", djId);
  return (data ?? [])
    .map((r: any) => r.tardeos)
    .filter((t: any) => t && t.estado === "publicado" && t.fecha >= hoy)
    .map(mapRow);
}

/** Actualiza el perfil de un DJ (bio, estilos, avatar…). */
export async function updateMiDj(id: string, fields: Record<string, unknown>) {
  return supabase.from("djs").update(fields).eq("id", id);
}

/** Sube el avatar del DJ al Storage y devuelve la URL pública. */
export async function subirAvatarDj(id: string, file: File): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ruta = `djs/${id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("flyers").upload(ruta, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) return null;
  return supabase.storage.from("flyers").getPublicUrl(ruta).data.publicUrl;
}

/** Tardeos de un local (cualquier estado), para el panel del local. */
export async function getTardeosDeLocal(localId: string): Promise<Tardeo[]> {
  const { data } = await supabase.from("tardeos").select(SELECT).eq("local_id", localId).order("fecha", { ascending: false });
  return (data ?? []).map(mapRow);
}

/** Un tardeo por id: primero Supabase, luego mock (para no romper enlaces en la transición). */
export async function getTardeoById(id: string): Promise<Tardeo | null> {
  try {
    const { data, error } = await supabase.from("tardeos").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    if (data) return mapRow(data);
  } catch (e) {
    console.error("[tardeos] getTardeoById fallback mock:", e);
  }
  return getTardeo(id) ?? null;
}

// ---------- Favoritos ----------
export async function esFavorito(uid: string, tid: string): Promise<boolean> {
  const { data } = await supabase.from("favoritos").select("tardeo_id").eq("profile_id", uid).eq("tardeo_id", tid).maybeSingle();
  return !!data;
}
export async function setFavorito(uid: string, tid: string, on: boolean): Promise<void> {
  if (on) await supabase.from("favoritos").insert({ profile_id: uid, tardeo_id: tid });
  else await supabase.from("favoritos").delete().eq("profile_id", uid).eq("tardeo_id", tid);
}
export async function getFavoritos(uid: string): Promise<Tardeo[]> {
  const { data } = await supabase.from("favoritos").select(`tardeos(${SELECT})`).eq("profile_id", uid);
  return (data ?? []).map((r: any) => r.tardeos).filter(Boolean).map(mapRow);
}

// ---------- Inscripciones (tardeos gratis) ----------
export async function estaInscrito(uid: string, tid: string): Promise<boolean> {
  const { data } = await supabase.from("inscripciones").select("id").eq("profile_id", uid).eq("tardeo_id", tid).eq("estado", "apuntado").maybeSingle();
  return !!data;
}
export async function inscribir(uid: string, tid: string): Promise<void> {
  await supabase.from("inscripciones").upsert({ profile_id: uid, tardeo_id: tid, estado: "apuntado" }, { onConflict: "tardeo_id,profile_id" });
}
export async function cancelarInscripcion(uid: string, tid: string): Promise<void> {
  await supabase.from("inscripciones").update({ estado: "cancelado" }).eq("profile_id", uid).eq("tardeo_id", tid);
}
export async function getInscripciones(uid: string): Promise<Tardeo[]> {
  const { data } = await supabase.from("inscripciones").select(`tardeos(${SELECT})`).eq("profile_id", uid).eq("estado", "apuntado");
  return (data ?? []).map((r: any) => r.tardeos).filter(Boolean).map(mapRow);
}
