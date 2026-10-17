import { supabase } from "./supabase";
import { registrar } from "./registro";

/**
 * El ADN del tardícola: los mismos criterios con los que se describe un tardeo,
 * pero en forma de preferencia.
 *
 * La cardinalidad NO es la misma que en el evento, y conviene tenerlo claro:
 *
 *   criterio        en el tardeo            en el tardícola
 *   música          un estilo               varios ("me gusta house Y latino")
 *   ambiente        varios                  varios
 *   tipo de evento  uno                     varios
 *   público         franjas a las que apunta UNA: es su edad, no un gusto
 *   dress code      uno                     varios
 *   zona            una (donde se celebra)  varias (por donde se mueve)
 *   precio          un importe              UN tope
 *
 * Con esto se puede cruzar persona ↔ evento para recomendar y para segmentar
 * los avisos, que es de lo que va la sección 3 del documento.
 */
export type AdnTardicola = {
  /** Ids de estilo de lib/musica (`electronica:afro house`) o de familia. */
  musica: string[];
  ambiente: string[];
  tiposEvento: string[];
  dressCodes: string[];
  zonas: string[];
  /** Su franja de edad. Una sola. */
  publico: string;
  /** Clave del tramo de precio que se puede permitir (los de ListaTardeos). */
  precioMax: string;
  /** Cuándo lo rellenó. null = nunca. */
  rellenadoEn: string | null;
};

export const ADN_VACIO: AdnTardicola = {
  musica: [], ambiente: [], tiposEvento: [], dressCodes: [], zonas: [],
  publico: "", precioMax: "", rellenadoEn: null,
};

const COLUMNAS = "musica,ambiente,tipos_evento,dress_codes,zonas,publico,precio_max,adn_en";

/**
 * El ADN de un usuario.
 *
 * Devuelve null solo si la consulta falla, y lo deja en el log. Vacío (todo a
 * cero) significa "no lo ha rellenado", que es distinto de "no se pudo leer":
 * si se confundieran, un fallo de red le volvería a pedir los gustos a alguien
 * que ya los dio. Es la misma trampa que duplicó locales y perfiles de DJ.
 */
export async function getAdn(profileId: string): Promise<AdnTardicola | null> {
  const { data, error } = await supabase
    .from("profiles").select(COLUMNAS).eq("id", profileId).maybeSingle();
  if (error) {
    registrar("adn", "no se pudo leer el perfil de gustos", error);
    return null;
  }
  if (!data) return { ...ADN_VACIO };
  return {
    musica: data.musica ?? [],
    ambiente: data.ambiente ?? [],
    tiposEvento: data.tipos_evento ?? [],
    dressCodes: data.dress_codes ?? [],
    zonas: data.zonas ?? [],
    publico: data.publico ?? "",
    precioMax: data.precio_max ?? "",
    rellenadoEn: data.adn_en ?? null,
  };
}

/** ¿Ha dicho ya lo que le gusta? Con un solo criterio ya se puede recomendar. */
export function tieneAdn(adn: AdnTardicola | null): boolean {
  if (!adn) return false;
  return Boolean(
    adn.musica.length || adn.ambiente.length || adn.tiposEvento.length ||
    adn.dressCodes.length || adn.zonas.length || adn.publico || adn.precioMax
  );
}

/**
 * Guarda el ADN.
 *
 * Las listas vacías se guardan como null y no como `[]`, igual que en el
 * tardeo: así "no me preguntes por esto" se distingue de "lo miré y no elegí".
 */
export async function guardarAdn(profileId: string, adn: AdnTardicola) {
  const oNull = (v: string[]) => (v.length ? v : null);
  return supabase
    .from("profiles")
    .update({
      musica: oNull(adn.musica),
      ambiente: oNull(adn.ambiente),
      tipos_evento: oNull(adn.tiposEvento),
      dress_codes: oNull(adn.dressCodes),
      zonas: oNull(adn.zonas),
      publico: adn.publico || null,
      precio_max: adn.precioMax || null,
      adn_en: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("id");
}

// ---------- Asistiré y lista de espera (lote 64) ----------

/** Falta el lote en la base: la pantalla degrada en vez de romperse. */
export const faltaLote = (e: { code?: string } | null | undefined) =>
  e?.code === "42883" || e?.code === "PGRST202" || e?.code === "42P01" || e?.code === "PGRST205";

export type MiAsistencia = { estado: "apuntado" | "espera" | "cancelado" | null; puesto: number | null };

function filaAsistencia(data: unknown): MiAsistencia {
  const f = (Array.isArray(data) ? data[0] : data) as { estado?: string; puesto?: number | null } | undefined;
  if (!f?.estado) return { estado: null, puesto: null };
  return { estado: f.estado as MiAsistencia["estado"], puesto: f.puesto ?? null };
}

/** Estado de quien mira. Sin el lote 64, cae a la consulta antigua (solo 'apuntado'). */
export async function getMiAsistencia(uid: string, tardeoId: string): Promise<MiAsistencia> {
  const { data, error } = await supabase.rpc("mi_asistencia", { p_tardeo: tardeoId });
  if (!error) return filaAsistencia(data);
  if (!faltaLote(error)) registrar("asistire", "no se pudo leer la asistencia", error);
  const r = await supabase.from("inscripciones").select("estado").eq("profile_id", uid).eq("tardeo_id", tardeoId).maybeSingle();
  return { estado: (r.data?.estado as MiAsistencia["estado"]) ?? null, puesto: null };
}

/**
 * Pulsar «Asistiré». La base decide confirmado o espera de forma atómica.
 * Sin el lote 64 se apunta como antes (y si está lleno, lo dice).
 */
export async function asistire(uid: string, tardeoId: string): Promise<{ r: MiAsistencia | null; error: string | null }> {
  const { data, error } = await supabase.rpc("asistire", { p_tardeo: tardeoId });
  if (!error) return { r: filaAsistencia(data), error: null };
  if (!faltaLote(error)) return { r: null, error: error.message };
  const v = await supabase.from("inscripciones").upsert({ profile_id: uid, tardeo_id: tardeoId, estado: "apuntado" }, { onConflict: "tardeo_id,profile_id" });
  if (v.error && /aforo completo/i.test(v.error.message)) return { r: null, error: "Lista llena. La lista de espera llega con el lote 64." };
  if (v.error) return { r: null, error: v.error.message };
  return { r: { estado: "apuntado", puesto: null }, error: null };
}

/** Retirar el Asistiré (o salir de la espera). La espera sube sola en la base. */
export async function retirarAsistencia(uid: string, tardeoId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("retirar_asistencia", { p_tardeo: tardeoId });
  if (!error) return { error: null };
  if (!faltaLote(error)) return { error: error.message };
  const v = await supabase.from("inscripciones").update({ estado: "cancelado" })
    .eq("profile_id", uid).eq("tardeo_id", tardeoId).select("id");
  return { error: v.error?.message ?? null };
}

export type QuienesVan = { total: number; perfiles: { alias: string; avatar_url: string | null }[]; falta: boolean };

/** Nº de confirmados y hasta 8 alias/fotos. Nunca email ni teléfono. */
export async function getQuienesVan(tardeoId: string): Promise<QuienesVan> {
  const { data, error } = await supabase.rpc("quienes_van", { p_tardeo: tardeoId });
  if (error) {
    if (!faltaLote(error)) registrar("asistire", "no se pudo leer quiénes van", error);
    return { total: 0, perfiles: [], falta: true };
  }
  const f = (Array.isArray(data) ? data[0] : data) as { total?: number; perfiles?: QuienesVan["perfiles"] } | undefined;
  return { total: Number(f?.total ?? 0), perfiles: f?.perfiles ?? [], falta: false };
}

// ---------- Zona elegida (cabecera) ----------
export const CLAVE_ZONA = "tc_zona";
export function leerZona(): string {
  try { return localStorage.getItem(CLAVE_ZONA) ?? ""; } catch { return ""; }
}
export function guardarZona(z: string) {
  try { localStorage.setItem(CLAVE_ZONA, z); } catch { /* sin almacenamiento */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("tc-zona", { detail: z }));
}

export type Zona = { slug: string; nombre: string; zona_madre: string; marca: string | null };
/** Catálogo de zonas (lote 63). Sin él, las de siempre. */
export async function getZonas(): Promise<Zona[]> {
  const { data, error } = await supabase.from("zonas").select("slug,nombre,zona_madre,marca").order("orden");
  if (error || !data?.length) {
    return ["Barcelona", "Maresme", "Costa Brava", "Girona", "Costa Daurada", "Tarragona"].map((n) => ({
      slug: n.toLowerCase().replace(/ /g, "-"), nombre: n, zona_madre: "barcelona", marca: null,
    }));
  }
  return data as Zona[];
}

// ---------- Tema claro / oscuro ----------
// Tres preferencias: claro, oscuro o «como el sistema» (la de siempre si no se
// ha elegido nada). En el navegador va en localStorage `tc_tema`; el script de
// app/layout.tsx la lee antes de pintar y, con «sistema», sigue a
// prefers-color-scheme también cuando cambia (el móvil pasa a oscuro de noche).
//
// En la cuenta (profiles.tema, lote 63) solo caben 'claro' y 'oscuro', y
// 'claro' es el valor por defecto de TODAS las filas: no distingue «lo eligió»
// de «nunca tocó nada». Por eso 'oscuro' en la cuenta manda siempre, y 'claro'
// se guarda tanto para «claro» como para «sistema» y no fuerza nada: si no, a
// cualquiera con sesión se le apagaría el oscuro de su móvil.
export type Tema = "claro" | "oscuro";
export type PreferenciaTema = Tema | "sistema";
const CLAVE_TEMA = "tc_tema";

function sistemaOscuro(): boolean {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; }
}
/** Preferencia guardada en este navegador (sin nada = sistema). */
export function preferenciaTema(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CLAVE_TEMA);
    if (v === "claro" || v === "oscuro") return v;
  } catch { /* nada */ }
  return "sistema";
}
export function aplicarTema(t: PreferenciaTema) {
  try {
    if (t === "sistema") localStorage.removeItem(CLAVE_TEMA);
    else localStorage.setItem(CLAVE_TEMA, t);
  } catch { /* nada */ }
  const oscuro = t === "oscuro" || (t === "sistema" && sistemaOscuro());
  document.documentElement.classList.toggle("dark", oscuro);
}
/** Lo que se ve ahora mismo (sea por elección o por el sistema). */
export function temaActual(): Tema {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "oscuro" : "claro";
}
/** Guarda la preferencia en el perfil (lote 63). Si falta la columna, queda en el navegador. */
export async function guardarTema(uid: string | null, t: PreferenciaTema) {
  aplicarTema(t);
  if (uid) await supabase.from("profiles").update({ tema: t === "oscuro" ? "oscuro" : "claro" }).eq("id", uid);
}
/** Con sesión, la cuenta manda si dice 'oscuro' (vale en otro móvil). Si dice
 *  'claro' y aquí estaba en oscuro, es que lo quitó en otro dispositivo: se
 *  vuelve a «sistema» (no a claro forzado, ver arriba). */
export async function sincronizarTema(uid: string) {
  const { data, error } = await supabase.from("profiles").select("tema").eq("id", uid).maybeSingle();
  if (error) return;
  if (data?.tema === "oscuro") aplicarTema("oscuro");
  else if (data?.tema === "claro" && preferenciaTema() === "oscuro") aplicarTema("sistema");
}

/** Avisos sin leer de la campana (lote 63). 0 si falta la tabla. */
export async function contarAvisosSinLeer(uid: string): Promise<number> {
  const { count, error } = await supabase.from("avisos").select("id", { count: "exact", head: true })
    .eq("profile_id", uid).is("leido_en", null);
  return error ? 0 : count ?? 0;
}

/** Precio en píldora (dossier pág. 5): GRATIS solo si no cuesta; X € si hay importe. */
export function precioCorto(t: { tipoEntrada: string; precio?: number }): string {
  if (t.tipoEntrada === "gratis") return "GRATIS";
  if (t.precio != null) return `${t.precio} €`;
  return t.tipoEntrada === "lista" ? "Lista" : "Entrada";
}
