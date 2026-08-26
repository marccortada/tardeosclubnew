import { supabase } from "./supabase";

/**
 * La promoción, como cosa propia.
 *
 * Antes eran dos campos sueltos dentro del tardeo. Ahora vive por su cuenta, y
 * eso es lo que permite lo que pedía el documento: código, fechas, límite de
 * usos, a quién va dirigida, y poder enseñarla en varios sitios sin copiarla.
 *
 * El pop-up pasa a ser UN CANAL para enseñarla, no la promoción en sí. Por eso
 * los campos de segmentación se llaman igual que en `popups` (lote 23): así una
 * promoción se puede mandar por ese canal sin traducir nada.
 */
export type Promocion = {
  id: string;
  tardeoId: string | null;
  localId: string | null;
  nombre: string;
  beneficio: string | null;
  codigo: string | null;
  desde: string | null;
  hasta: string | null;
  limiteUsos: number | null;
  usos: number;
  activa: boolean;
  segMusica: string[];
  segTiposEvento: string[];
  segEdades: string[];
  segZonas: string[];
};

/**
 * ¿El error es solo que la tabla todavía no existe (lote 32 sin pegar)?
 *
 * Son DOS códigos y no uno: Postgres dice 42P01, pero PostgREST responde antes
 * con PGRST205 cuando la tabla no está en su caché de esquema, que es lo que
 * llega de verdad. Con solo el primero, la app funcionaba pero escupía un error
 * por cada visita a una ficha de tardeo.
 *
 * Sin promociones se vive; con la ficha del tardeo rota, no.
 */
function tablaSinCrear(error: { code?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205";
}

const COLUMNAS =
  "id,tardeo_id,local_id,nombre,beneficio,codigo,desde,hasta,limite_usos,usos,activa," +
  "seg_musica,seg_tipos_evento,seg_edades,seg_zonas";

function mapRow(r: any): Promocion {
  return {
    id: r.id,
    tardeoId: r.tardeo_id ?? null,
    localId: r.local_id ?? null,
    nombre: r.nombre,
    beneficio: r.beneficio ?? null,
    codigo: r.codigo ?? null,
    desde: r.desde ?? null,
    hasta: r.hasta ?? null,
    limiteUsos: r.limite_usos ?? null,
    usos: r.usos ?? 0,
    activa: r.activa ?? true,
    segMusica: r.seg_musica ?? [],
    segTiposEvento: r.seg_tipos_evento ?? [],
    segEdades: r.seg_edades ?? [],
    segZonas: r.seg_zonas ?? [],
  };
}

/**
 * ¿Está viva ahora mismo?
 *
 * La misma regla que `promo_vigente` en la base (lote 32). Se repite aquí a
 * propósito y NO para filtrar —de eso ya se encarga la política de lectura,
 * que sencillamente no devuelve las caducadas— sino para el panel del dueño,
 * que sí las ve todas y necesita distinguir cuáles están corriendo.
 */
export function vigente(p: Promocion, ahora = new Date()): boolean {
  if (!p.activa) return false;
  if (p.desde && new Date(p.desde) > ahora) return false;
  if (p.hasta && new Date(p.hasta) < ahora) return false;
  if (p.limiteUsos != null && p.usos >= p.limiteUsos) return false;
  return true;
}

/** Por qué NO está viva, para decírselo al dueño en su panel. */
export function porQueNoCorre(p: Promocion, ahora = new Date()): string | null {
  if (!p.activa) return "Apagada";
  if (p.desde && new Date(p.desde) > ahora) return "Aún no ha empezado";
  if (p.hasta && new Date(p.hasta) < ahora) return "Ya terminó";
  if (p.limiteUsos != null && p.usos >= p.limiteUsos) return "Agotada";
  return null;
}

/**
 * Las de un tardeo. Al público la base solo le devuelve las vigentes; al dueño
 * y al admin, todas.
 */
export async function getPromosDeTardeo(tardeoId: string): Promise<Promocion[]> {
  const { data, error } = await supabase
    .from("promociones").select(COLUMNAS).eq("tardeo_id", tardeoId)
    .order("created_at", { ascending: true });
  if (error && !tablaSinCrear(error)) console.error("[promos] tardeo:", error.message);
  return (data ?? []).map(mapRow);
}

export async function getPromosDeLocal(localId: string): Promise<Promocion[]> {
  const { data, error } = await supabase
    .from("promociones").select(COLUMNAS).eq("local_id", localId)
    .order("created_at", { ascending: true });
  if (error && !tablaSinCrear(error)) console.error("[promos] local:", error.message);
  return (data ?? []).map(mapRow);
}

export async function crearPromo(campos: Record<string, unknown>) {
  return supabase.from("promociones").insert(campos).select("id");
}

export async function actualizarPromo(id: string, campos: Record<string, unknown>) {
  return supabase.from("promociones").update(campos).eq("id", id).select("id");
}

export async function borrarPromo(id: string) {
  // `.select()` para saber CUÁNTAS filas se borraron: sin permiso la base no
  // da error, borra cero y responde que todo bien.
  return supabase.from("promociones").delete().eq("id", id).select("id");
}
