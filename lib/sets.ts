import { supabase } from "./supabase";
import { mensajeAmable } from "./mensajeError";

/**
 * Sets de los DJs, seguir, ♥, guardar, comentarios y Nexo (lote 65).
 *
 * Todo lo que toca tablas del lote 65 devuelve `faltaLote` cuando aún no está
 * aplicado (42P01 tabla, 42883/PGRST202 función, 42703/PGRST204 columna), para
 * que la pantalla diga «no disponible» en vez de romperse. Al público nunca se
 * le habla de «lotes»: eso solo en el admin (MENSAJE_FALTA_LOTE).
 */

export type Plataforma = "soundcloud" | "youtube" | "mixcloud" | "audio" | "otra";

export type SetDj = {
  id: string;
  dj_id: string;
  titulo: string;
  url: string;
  plataforma: Plataforma;
  portada: string | null;
  estilos: string[];
  destacado: boolean;
  duracion: number | null;
  orden: number;
  oculto?: boolean;
  likes: number;
  comentarios: number;
  guardados: number;
  created_at: string;
};

export type Comentario = {
  id: string;
  set_id: string;
  autor: string | null;
  texto: string;
  respuesta_de: string | null;
  es_dj: boolean;
  oculto: boolean;
  created_at: string;
  alias?: string | null;
  foto?: string | null;
};

export type EnvioNexo = {
  id: string;
  dj_id: string;
  set_id: string | null;
  titulo: string;
  url: string;
  descripcion: string | null;
  estado: "pendiente" | "aceptado" | "rechazado" | "emitido";
  nota_nexo: string | null;
  created_at: string;
  revisado_en: string | null;
};

export type TarjetaFeed = {
  dj_id: string; nombre: string; avatar_url: string | null; banner_url: string | null;
  ciudad: string | null; estilos: string[] | null; seguidores: number; siguiendo: boolean;
  set_id: string | null; set_titulo: string | null; set_url: string | null;
  set_plataforma: Plataforma | null; set_portada: string | null; set_estilos: string[] | null;
  set_likes: number | null; set_comentarios: number | null; me_gusta: boolean; guardado: boolean;
  evento_id: string | null; evento_titulo: string | null; evento_fecha: string | null;
  evento_flyer: string | null; evento_local: string | null; afinidad: number;
};

export const ESTADOS_NEXO: Record<EnvioNexo["estado"], string> = {
  pendiente: "Pendiente de revisión",
  aceptado: "Aceptada",
  rechazado: "No seleccionada",
  emitido: "Emitida",
};

export const SELECT_SET = "id,dj_id,titulo,url,plataforma,portada,estilos,destacado,duracion,orden,oculto,likes,comentarios,guardados,created_at";

type ErrorPg = { code?: string; message?: string } | null | undefined;

export function faltaLote(e: ErrorPg): boolean {
  if (!e) return false;
  return ["42P01", "42883", "PGRST202", "PGRST205", "42703", "PGRST204"].includes(e.code ?? "")
    || /does not exist|Could not find/i.test(e.message ?? "");
}

/** Solo para pantallas del admin: dice qué lote falta. */
export const MENSAJE_FALTA_LOTE = "Falta el lote 65 en la base de datos (música). Avisa al administrador.";

/** Lo que ve el público (tardícola, DJ, local) si falta el lote. */
export const MENSAJE_NO_DISPONIBLE = "Esta sección aún no está disponible.";

/** Error de la base → frase para el público (sin jerga ni mensajes en inglés). */
export function errorPublico(e: ErrorPg): string {
  return faltaLote(e) ? MENSAJE_NO_DISPONIBLE : mensajeAmable(e);
}

/** De qué plataforma es un enlace: decide cómo lo toca el reproductor. */
export function plataformaDe(url: string): Plataforma {
  const u = (url || "").trim();
  if (/soundcloud\.com\//i.test(u)) return "soundcloud";
  if (/(youtube\.com\/|youtu\.be\/)/i.test(u)) return "youtube";
  if (/mixcloud\.com\//i.test(u)) return "mixcloud";
  if (/\.(mp3|m4a|aac|ogg|oga|opus|wav)(\?|#|$)/i.test(u) || /\/(stream|live|listen)(\/|\?|$|\.)/i.test(u)) return "audio";
  return "otra";
}

/** Miniatura de YouTube como portada por defecto (es pública y no pide clave). */
export function portadaPorDefecto(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : null;
}

export function portadaDe(s: { portada?: string | null; url?: string | null }): string | null {
  return s.portada || (s.url ? portadaPorDefecto(s.url) : null);
}

// ── Lectura ───────────────────────────────────────────────────────────────

export async function getSetsDeDj(djId: string): Promise<{ data: SetDj[]; error: string | null; faltaLote: boolean }> {
  const { data, error } = await supabase.from("sets").select(SELECT_SET).eq("dj_id", djId)
    .order("destacado", { ascending: false }).order("orden").order("created_at", { ascending: false });
  if (error) return { data: [], error: errorPublico(error), faltaLote: faltaLote(error) };
  return { data: (data ?? []) as SetDj[], error: null, faltaLote: false };
}

export async function getFeed(siguiendo: boolean, estilos: string[], desde: number, limite = 6) {
  const { data, error } = await supabase.rpc("feed_djs", {
    p_siguiendo: siguiendo, p_estilos: estilos, p_desde: desde, p_limite: limite,
  });
  if (error) return { data: [] as TarjetaFeed[], error: errorPublico(error) };
  return { data: (data ?? []) as TarjetaFeed[], error: null };
}

/** Press kit: la base solo devuelve la URL a profesionales (o al dueño). */
export async function getPresskit(djId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("presskit_de", { p_dj: djId });
  if (error) return null;
  return typeof data === "string" && data.startsWith("http") ? data : null;
}

// ── Seguir, ♥ y guardar ───────────────────────────────────────────────────

async function alternar(tabla: string, campo: "dj_id" | "set_id", id: string, uid: string, activar: boolean) {
  const { error } = activar
    ? await supabase.from(tabla).insert({ profile_id: uid, [campo]: id })
    : await supabase.from(tabla).delete().eq("profile_id", uid).eq(campo, id);
  // Duplicado = ya estaba: el estado final es el que se quería.
  if (error && error.code !== "23505") return errorPublico(error);
  return null;
}
export const seguirDj = (djId: string, uid: string, si: boolean) => alternar("seguidores_dj", "dj_id", djId, uid, si);
export const gustarSet = (setId: string, uid: string, si: boolean) => alternar("sets_likes", "set_id", setId, uid, si);
export const guardarSet = (setId: string, uid: string, si: boolean) => alternar("sets_guardados", "set_id", setId, uid, si);

/**
 * Resultado de marcar/desmarcar con detalle. `cambio = false` significa "ya
 * estaba así" (23505 al dar de alta, o ninguna fila borrada al quitar): el
 * estado final es el pedido, pero el contador de la base NO se ha movido, así
 * que la pantalla no debe sumar ni restar. Con `alternar` a secas un 23505 se
 * daba por éxito y la tarjeta enseñaba un ♥ de más.
 */
export type ResultadoMarca = { error: string | null; cambio: boolean };

async function alternarDetalle(tabla: string, campo: "dj_id" | "set_id", id: string, uid: string, activar: boolean): Promise<ResultadoMarca> {
  if (activar) {
    const { error } = await supabase.from(tabla).insert({ profile_id: uid, [campo]: id });
    if (!error) return { error: null, cambio: true };
    if (error.code === "23505") return { error: null, cambio: false };
    return { error: errorPublico(error), cambio: false };
  }
  // `.select()` devuelve las filas borradas (la política de lectura deja ver
  // las propias): cero filas = no estaba marcado y el contador no ha bajado.
  const { data, error } = await supabase.from(tabla).delete().eq("profile_id", uid).eq(campo, id).select(campo);
  if (error) return { error: errorPublico(error), cambio: false };
  return { error: null, cambio: (data ?? []).length > 0 };
}
export const gustarSetDetalle = (setId: string, uid: string, si: boolean) => alternarDetalle("sets_likes", "set_id", setId, uid, si);
export const guardarSetDetalle = (setId: string, uid: string, si: boolean) => alternarDetalle("sets_guardados", "set_id", setId, uid, si);

/** Seguidores reales del DJ (contador que mantiene el disparador del lote 65). */
export async function seguidoresDe(djId: string): Promise<number | null> {
  const { data, error } = await supabase.from("djs").select("seguidores").eq("id", djId).maybeSingle();
  if (error || !data) return null;
  return (data as { seguidores: number | null }).seguidores ?? 0;
}

export async function sigoA(djId: string, uid: string): Promise<boolean> {
  const { data } = await supabase.from("seguidores_dj").select("dj_id").eq("profile_id", uid).eq("dj_id", djId).maybeSingle();
  return !!data;
}

/** Qué sets de la lista me gustan / tengo guardados. */
export async function misMarcas(uid: string, ids: string[]) {
  if (!ids.length) return { likes: new Set<string>(), guardados: new Set<string>() };
  const [l, g] = await Promise.all([
    supabase.from("sets_likes").select("set_id").eq("profile_id", uid).in("set_id", ids),
    supabase.from("sets_guardados").select("set_id").eq("profile_id", uid).in("set_id", ids),
  ]);
  return {
    likes: new Set(((l.data ?? []) as { set_id: string }[]).map((r) => r.set_id)),
    guardados: new Set(((g.data ?? []) as { set_id: string }[]).map((r) => r.set_id)),
  };
}

// ── Comentarios ───────────────────────────────────────────────────────────

export async function getComentarios(setId: string): Promise<{ data: Comentario[]; error: string | null }> {
  const { data, error } = await supabase.from("sets_comentarios")
    .select("id,set_id,autor,texto,respuesta_de,es_dj,oculto,created_at")
    .eq("set_id", setId).order("created_at").order("id").limit(300);
  if (error) return { data: [], error: errorPublico(error) };
  const filas = (data ?? []) as Comentario[];
  // Alias y foto: perfil_publico (lote 63) nunca devuelve email ni teléfono.
  const ids = [...new Set(filas.map((c) => c.autor).filter(Boolean))] as string[];
  if (ids.length) {
    const { data: p } = await supabase.rpc("perfil_publico", { p_ids: ids });
    const m = new Map(((p ?? []) as { id: string; alias: string | null; avatar_url: string | null }[]).map((x) => [x.id, x]));
    for (const c of filas) { const x = c.autor ? m.get(c.autor) : null; c.alias = x?.alias ?? null; c.foto = x?.avatar_url ?? null; }
  }
  return { data: filas, error: null };
}

export async function comentar(setId: string, uid: string, texto: string, respuestaDe: string | null = null) {
  const { error } = await supabase.from("sets_comentarios")
    .insert({ set_id: setId, autor: uid, texto: texto.trim(), respuesta_de: respuestaDe });
  if (error) return errorPublico(error);
  return null;
}

export async function borrarComentario(id: string) {
  const { error } = await supabase.from("sets_comentarios").delete().eq("id", id);
  return error ? errorPublico(error) : null;
}

// ── Gestión del DJ ────────────────────────────────────────────────────────

export type NuevoSet = { titulo: string; url: string; portada?: string | null; estilos?: string[]; destacado?: boolean; orden?: number };

export async function crearSet(djId: string, s: NuevoSet) {
  const url = s.url.trim();
  const { error } = await supabase.from("sets").insert({
    dj_id: djId, titulo: s.titulo.trim(), url, plataforma: plataformaDe(url),
    portada: s.portada?.trim() || portadaPorDefecto(url), estilos: s.estilos ?? [],
    destacado: !!s.destacado, orden: s.orden ?? 0,
  });
  if (error) return errorPublico(error);
  return null;
}

export async function actualizarSet(id: string, cambios: Partial<Pick<SetDj, "titulo" | "url" | "portada" | "estilos" | "destacado" | "orden">>) {
  const c: Record<string, unknown> = { ...cambios };
  if (typeof cambios.url === "string") c.plataforma = plataformaDe(cambios.url);
  // `.select`: 0 filas = la base no dejó (RLS), aunque no haya error.
  const { data, error } = await supabase.from("sets").update(c).eq("id", id).select("id");
  if (error) return errorPublico(error);
  return data?.length ? null : "No se ha podido guardar: este set no es tuyo o ya no existe.";
}

/** Un solo destacado por DJ: se quita a los demás y se pone a este. */
export async function destacarSet(djId: string, id: string) {
  const a = await supabase.from("sets").update({ destacado: false }).eq("dj_id", djId).neq("id", id);
  if (a.error) return errorPublico(a.error);
  return actualizarSet(id, { destacado: true });
}

export async function borrarSet(id: string) {
  const { error } = await supabase.from("sets").delete().eq("id", id);
  return error ? errorPublico(error) : null;
}
