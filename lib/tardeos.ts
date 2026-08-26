import { supabase } from "./supabase";
import { Tardeo } from "./types";
import { memo } from "@/lib/memo";
import { plegar } from "@/lib/texto";

// Acotado a lo que usa mapRow. Con `locales(*)` venían descripción, redes,
// fotos, horarios y el email de cada local: 42 KB por consulta en vez de 30.
const SELECT =
  "*, locales(id,nombre,zona,direccion,verificado,logo_url,tipo)," +
  "tardeo_djs(djs(id,nombre_artistico,estilos,verificado,reputacion_score,avatar_url))";

/**
 * Qué cuenta como "está a la vista" (lote 25).
 *
 * Un `programado` sale solo cuando le llega la hora. Se repite en las tres
 * consultas públicas, así que vive aquí: la primera vez que una se quede sin
 * actualizar, un local verá su tardeo en el mapa pero no en el listado y nadie
 * entenderá por qué.
 *
 * OJO: esto es solo para no traerse filas de más. Quien de verdad decide es la
 * política de la base, que usa el reloj del SERVIDOR. Con la hora del navegador
 * cambiada no se adelanta nada.
 */
const A_LA_VISTA = () =>
  `estado.eq.publicado,and(estado.eq.programado,publicar_en.lte.${new Date().toISOString()})`;

/**
 * Caché en memoria de la lista pública de tardeos.
 *
 * Home, /tardeos y /mapa piden exactamente lo mismo, y antes cada navegación
 * disparaba su propia consulta: se veía el spinner otra vez para enseñar datos
 * que ya teníamos. Dura poco a propósito, que esto cambia cuando un local
 * publica.
 */
const CACHE_MS = 60_000;
let cache: { cuando: number; datos: Tardeo[] } | null = null;
let enVuelo: Promise<Tardeo[]> | null = null;
// Sube en cada invalidación. Una consulta que empezó antes no puede guardar su
// resultado si mientras tanto alguien publicó: traería datos ya viejos y los
// dejaría fijados otro minuto.
let generacion = 0;

/** Tira la caché: úsalo tras publicar o editar un tardeo. */
export function invalidarCacheTardeos() {
  cache = null;
  enVuelo = null;
  generacion++;
}

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
      logo: loc.logo_url ?? undefined,
      tipo: loc.tipo === "promotor" ? "promotor" : "local",
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
    // Columnas del lote 20. Mientras el SQL no esté pegado llegan vacías y se
    // comportan como "sin indicar", sin romper nada.
    promoTitulo: r.promo_titulo ?? undefined,
    promoTexto: r.promo_texto ?? undefined,
    etiquetas: Array.isArray(r.etiquetas) ? r.etiquetas : [],
    tipoEvento: r.tipo_evento ?? undefined,
    ambiente: Array.isArray(r.ambiente) ? r.ambiente : [],
    publico: Array.isArray(r.publico) ? r.publico : [],
    dressCode: r.dress_code ?? undefined,
    destacado: r.destacado_hasta ? new Date(r.destacado_hasta) > new Date() : false,
    estado: r.estado,
    publicarEn: r.publicar_en ?? undefined,
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
 * Hasta dónde mira la app: un mes desde hoy.
 *
 * Un tardeo a cuatro meses vista no ayuda a decidir el plan de este finde y
 * ensucia el listado, el mapa y las recomendaciones. El local puede publicarlo
 * igual —sale en su panel y en su calendario—, simplemente no asoma en la parte
 * pública hasta que entra en el mes.
 *
 * La ventana se mueve sola cada día, así que un tardeo del mes que viene va
 * apareciendo según se acerca. No hace falta ningún proceso que lo despierte.
 */
export const DIAS_DE_VISTA = 30;

export function horizonteISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + DIAS_DE_VISTA);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
}

/**
 * Los tardeos que se enseñan: de hoy hasta un mes vista.
 *
 * Fuera los pasados (no ayudan a nadie) y fuera los de dentro de tres meses,
 * que ensucian el listado sin ayudar a decidir el plan del finde.
 * Cachea un minuto y comparte la petición en vuelo, para que dos componentes
 * que la piden a la vez no hagan dos viajes.
 */
export async function getTardeosPublicados(): Promise<Tardeo[]> {
  if (cache && Date.now() - cache.cuando < CACHE_MS) return cache.datos;
  if (enVuelo) return enVuelo;

  const hoy = hoyISO();
  const gen = generacion;
  enVuelo = (async () => {
    try {
      const { data, error } = await supabase
        .from("tardeos")
        .select(SELECT)
        .or(A_LA_VISTA())
        .gte("fecha", hoy)
        .lte("fecha", horizonteISO())
        .order("fecha", { ascending: true });
      if (error) throw error;
      const datos = (data ?? []).map(mapRow);
      // Si alguien invalidó mientras esto viajaba, no lo guardamos.
      if (gen === generacion) cache = { cuando: Date.now(), datos };
      return datos;
    } catch (e) {
      console.error("[tardeos] Error cargando tardeos:", e);
      // En build hay que reventar. Devolver [] aquí hornea la portada, /tardeos
      // y /mapa vacías y `next build` termina en verde: se despliega una web sin
      // contenido y nadie se entera hasta que un usuario la abre. Pasó de verdad.
      // En ejecución es lo contrario: una lista vacía se recupera al revalidar,
      // y es mejor que enseñarle un 500 a quien está mirando.
      if (process.env.NEXT_PHASE === "phase-production-build") throw e;
      return [];
    } finally {
      enVuelo = null;
    }
  })();
  return enVuelo;
}

/**
 * Directorio público de locales y promotores.
 *
 * Solo activos. Los destacados salen primero, en el orden del admin; el resto,
 * los verificados por delante y luego alfabético, que en un listado de negocios
 * es lo que la gente espera.
 */
async function leerLocalesPublicos(): Promise<any[]> {
  const { data, error } = await supabase
    .from("locales")
    .select("id,nombre,zona,direccion,logo_url,tipo,verificado,destacado_orden")
    .eq("estado", "activo")
    .order("destacado_orden", { ascending: true, nullsFirst: false })
    .order("verificado", { ascending: false })
    .order("nombre", { ascending: true });
  if (error) console.error("[locales] directorio:", error.message);
  return data ?? [];
}

/**
 * Locales y promotores destacados, en el orden que fijó el admin.
 *
 * Solo activos: un local en borrador o suspendido por impago no puede salir
 * en portada aunque alguien lo destacara en su día.
 */
async function leerLocalesDestacados(limite = 10): Promise<{ locales: any[]; sonDePago: boolean }> {
  const { data, error } = await supabase
    .from("locales")
    .select("id,nombre,zona,logo_url,tipo,verificado,destacado_orden")
    .eq("estado", "activo")
    .not("destacado_orden", "is", null)
    .order("destacado_orden", { ascending: true })
    .limit(limite);
  if (error) console.error("[locales] destacados:", error.message);
  if (data?.length) return { locales: data, sonDePago: true };

  // Nadie destacado todavía: en vez de dejar el hueco, se enseñan los locales
  // que tienen tardeos publicados. Son los que están vivos, que es lo que le
  // interesa a quien entra. El que llama cambia el título para no llamar
  // "destacado" a algo que nadie ha pagado.
  const hoy = hoyISO();
  const { data: conTardeos } = await supabase
    .from("tardeos")
    .select("locales(id,nombre,zona,logo_url,tipo,verificado)")
    .or(A_LA_VISTA())
    .gte("fecha", hoy)
    .lte("fecha", horizonteISO())
    .order("fecha", { ascending: true })
    .limit(60);

  const vistos = new Set<string>();
  const locales: any[] = [];
  for (const fila of (conTardeos ?? []) as any[]) {
    const l = fila.locales;
    if (!l?.id || vistos.has(l.id)) continue;
    vistos.add(l.id);
    locales.push(l);
    if (locales.length >= limite) break;
  }
  return { locales, sonDePago: false };
}

/**
 * Un local por id (para su página pública).
 *
 * Columnas explícitas y sin `email`: la política de lectura hace pública la
 * fila entera de un local activo, así que con `select("*")` cualquiera podía
 * bajarse los 59 correos de golpe. La ficha nunca los ha enseñado.
 */
export async function getLocalById(id: string): Promise<any | null> {
  const { data } = await supabase
    .from("locales")
    .select("id,nombre,descripcion,direccion,lat,lng,zona,telefono,redes,fotos,horarios,verificado,estado,logo_url,tipo,playlist_url")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/** Tardeos publicados y no expirados de un local (para su página pública). */
export async function getTardeosPublicadosDeLocal(localId: string): Promise<Tardeo[]> {
  const hoy = hoyISO();
  const { data } = await supabase
    .from("tardeos")
    .select(SELECT)
    .eq("local_id", localId)
    .or(A_LA_VISTA())
    .gte("fecha", hoy)
    .lte("fecha", horizonteISO())
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
  // Columnas explícitas y no `*`: con `*` cualquier columna que el rol no
  // pueda leer hace fallar la consulta entera, y el dueño se queda sin su
  // local. Pasó con `email` al restringirla en el lote 14.
  const { data, error } = await supabase
    .from("locales")
    .select("id,nombre,descripcion,direccion,lat,lng,zona,codigo_postal,telefono,redes,fotos,horarios,verificado,estado,logo_url,tipo,owner_id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  // Antes el error se tragaba en silencio y devolvía null, que la app
  // interpreta como "no tienes local": el dueño creaba otro y acababa con
  // duplicados. Sigue devolviendo null (cinco sitios la llaman y varios sin
  // catch), pero al menos deja rastro de que fue un fallo y no una ausencia.
  if (error) console.error("[locales] no se pudo cargar tu local:", error.message);
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

/** Lista de apuntados a los tardeos de un local (con nombre). Requiere Lote 8. */
export async function getInscritosLocal(localId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc("inscritos_de_local", { p_local: localId });
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * El perfil DJ del usuario (si lo tiene).
 *
 * Mismo cuidado que en getMiLocal, y por el mismo motivo: /dj enseña "Crear mi
 * perfil DJ" en cuanto esto devuelve null, así que un fallo de lectura no se
 * ve como un fallo — se ve como que no tienes perfil, y acabas con dos. Con
 * `select("*")` bastaba con restringir una columna cualquiera de `djs` (como
 * pasó con `email` en locales) para que la consulta entera reventara.
 */
export async function getMiDj(profileId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("djs")
    .select("id,profile_id,nombre_artistico,bio,estilos,galeria,redes,verificado,reputacion_score,oculto,avatar_url,playlist_url,zonas,contacto")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) console.error("[djs] no se pudo cargar tu perfil DJ:", error.message);
  return data ?? null;
}

/** Lista pública de DJs (no ocultos), ordenados por reputación. */
async function leerDjsPublicos(): Promise<any[]> {
  const { data } = await supabase
    .from("djs")
    .select("id,nombre_artistico,estilos,avatar_url,verificado,reputacion_score,destacado_orden")
    .eq("oculto", false)
    // Los destacados mandan y en el orden que fijó el admin (1, 2, 3…).
    // nullsFirst: false deja detrás a los que no lo están; entre ellos sigue
    // decidiendo la reputación de siempre.
    .order("destacado_orden", { ascending: true, nullsFirst: false })
    .order("verificado", { ascending: false })
    .order("reputacion_score", { ascending: false });
  return data ?? [];
}

/**
 * Un DJ por id (para su página pública).
 *
 * Columnas explícitas, como en getLocalById: con `*` la ficha pública servía
 * también `profile_id` (el id de la cuenta) y `origen_id`, que no pinta nada
 * ahí y ata al DJ con su usuario de auth.
 */
export async function getDjById(id: string): Promise<any | null> {
  const { data } = await supabase
    .from("djs")
    .select("id,nombre_artistico,bio,estilos,galeria,redes,verificado,reputacion_score,avatar_url,playlist_url,zonas,contacto")
    .eq("id", id)
    .maybeSingle();
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

/**
 * Sube el logo del local al Storage y devuelve su URL pública.
 *
 * Es el que sale en la chincheta del mapa, así que conviene que sea cuadrado o
 * casi: la chincheta lo recorta al centro.
 */
export async function subirLogoLocal(id: string, file: File): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ruta = `locales/${id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("flyers").upload(ruta, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) return null;
  return supabase.storage.from("flyers").getPublicUrl(ruta).data.publicUrl;
}

/** Fila cruda de un tardeo (para editar). RLS deja leer al dueño aunque no esté publicado. */
export async function getTardeoRow(id: string): Promise<any | null> {
  const { data } = await supabase.from("tardeos").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

// Los tres tiran la caché: si no, el local edita o despublica y sigue viendo
// lo de antes durante un minuto, que parece que la app no le ha hecho caso.

/** Actualiza un tardeo (solo el dueño o admin, por RLS). Devuelve las filas afectadas en `data`. */
export async function updateTardeo(id: string, fields: Record<string, unknown>) {
  invalidarCacheTardeos();
  return supabase.from("tardeos").update(fields).eq("id", id).select("id");
}

/** Cambia el estado (publicado / borrador / finalizado / cancelado). */
export async function setEstadoTardeo(id: string, estado: string) {
  invalidarCacheTardeos();
  return supabase.from("tardeos").update({ estado }).eq("id", id).select("id");
}

/** Borra un tardeo (solo el dueño o admin, por RLS). `count` indica filas borradas. */
export async function borrarTardeo(id: string) {
  invalidarCacheTardeos();
  return supabase.from("tardeos").delete({ count: "exact" }).eq("id", id);
}

export type EnlaceDjs = {
  /** Nombres que sí tienen ficha y han quedado enlazados. */
  enlazados: string[];
  /** Nombres escritos en el flyer que no corresponden a ningún DJ fichado. */
  sinFicha: string[];
};

/**
 * Enlaza a un tardeo los DJs que ya tienen ficha, buscándolos por su nombre.
 *
 * Compara sin tildes ni mayúsculas y tolerando el "DJ " de delante: en un
 * flyer lo mismo pone "José AM" que "DJ Jose AM", y con comparación exacta no
 * casaba ninguno de los dos con la ficha "Jose AM".
 *
 * Devuelve también los nombres que NO encontró. Antes solo contaba los
 * enlazados, así que un flyer con un DJ sin ficha se publicaba sin decir nada
 * y ese tardeo no salía nunca en el perfil de nadie.
 */
export async function vincularDjsPorNombre(tardeoId: string, nombres: string[]): Promise<EnlaceDjs> {
  const limpios = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))];
  if (limpios.length === 0) return { enlazados: [], sinFicha: [] };

  // El "DJ" se quita esté delante o detrás: en las fichas está de las dos
  // formas ("Dj Taño", "German Navarro DJ") y en los flyers, de cualquiera.
  const clave = (s: string) => plegar(s).replace(/^dj\s+/, "").replace(/\s+dj$/, "").trim();

  const { data } = await supabase.from("djs").select("id,nombre_artistico");
  const fichados = (data ?? []).map((d: any) => ({ ...d, clave: clave(d.nombre_artistico || "") }));

  const enlazados: string[] = [];
  const sinFicha: string[] = [];
  const filas: { tardeo_id: string; dj_id: string }[] = [];

  for (const n of limpios) {
    const dj = fichados.find((d) => d.clave && d.clave === clave(n));
    if (dj) { enlazados.push(n); filas.push({ tardeo_id: tardeoId, dj_id: dj.id }); }
    else sinFicha.push(n);
  }

  if (filas.length) await supabase.from("tardeo_djs").upsert(filas, { onConflict: "tardeo_id,dj_id" });
  return { enlazados, sinFicha };
}

/** Reemplaza por completo los DJs de un tardeo (borra y revincula por nombre). */
export async function setDjsDeTardeo(tardeoId: string, nombres: string[]): Promise<EnlaceDjs> {
  await supabase.from("tardeo_djs").delete().eq("tardeo_id", tardeoId);
  return vincularDjsPorNombre(tardeoId, nombres);
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
    return data ? mapRow(data) : null;
  } catch (e) {
    console.error("[tardeos] getTardeoById error:", e);
    return null;
  }
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


// ---------- Caché de las listas públicas ----------
/**
 * Las páginas de listado (/, /tardeos, /mapa, /colaboradores) se pintan en cada
 * visita desde que dejaron de usar la regeneración de Next, que se atascaba.
 * Sin esto, cada visita serían tres o cuatro viajes a Supabase; con esto, como
 * mucho uno por minuto y por dato.
 *
 * `getTardeosPublicados` ya llevaba su propia caché igual desde antes.
 */
const memoLocalesPublicos = memo(() => leerLocalesPublicos());
const memoDjsPublicos = memo(() => leerDjsPublicos());
const memoLocalesDestacados = memo(() => leerLocalesDestacados(10));

export function getLocalesPublicos(): Promise<any[]> {
  return memoLocalesPublicos.get();
}

export function getDjsPublicos(): Promise<any[]> {
  return memoDjsPublicos.get();
}

export function getLocalesDestacados(limite = 10): Promise<{ locales: any[]; sonDePago: boolean }> {
  // La caché cubre el caso normal, que es el único que se usa. Con otro límite
  // se consulta directo: no compensa una caché por cada valor posible.
  return limite === 10 ? memoLocalesDestacados.get() : leerLocalesDestacados(limite);
}

/** Que la portada y el directorio vean ya un cambio del panel. */
export function invalidarCacheListas() {
  memoLocalesPublicos.invalidar();
  memoDjsPublicos.invalidar();
  memoLocalesDestacados.invalidar();
}
