import { supabase } from "./supabase";
import { Tardeo } from "./types";
import { memo } from "@/lib/memo";
import { plegar } from "@/lib/texto";
import { puedeSiActivo } from "@/lib/planes";
import { planesActivos } from "@/lib/ajustes";
import { registrar, avisar } from "./registro";

// Acotado a lo que usa mapRow. Con `locales(*)` venían descripción, redes,
// fotos, horarios y el email de cada local: 42 KB por consulta en vez de 30.
const SELECT =
  "*, locales(id,nombre,zona,direccion,verificado,logo_url,tipo,plan,"
  // El ADN del local viaja con el tardeo para poder recomendar cuando el
  // tardeo no dice nada de sí mismo, que son casi todos.
  + "ambiente,musica,publico,dress_code,tipo_local)," +
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
const memoTardeos = memo("tardeos-publicados", () => leerTardeosPublicados());
const memoMasAdelante = memo("tardeos-mas-adelante", () => leerTardeosMasAdelante(24));

/** Tira la caché: úsalo tras publicar o editar un tardeo. */
export function invalidarCacheTardeos() {
  memoTardeos.invalidar();
  memoMasAdelante.invalidar();
}

/**
 * Aplica las reglas del plan a lo que se enseña de un local.
 *
 * Vive AQUÍ y no en cada pantalla a propósito. El logo y el sello se pintan en
 * el mapa, en las tarjetas, en la hoja del mapa, en la ficha del tardeo y en el
 * directorio: seis sitios. Si la regla estuviera repartida, el día que cambie
 * se quedaría alguno sin actualizar y un local vería su logo en un sitio y no
 * en otro sin entender por qué.
 *
 * Quitar el logo no deja hueco: el mapa ya cae a la chincheta de TardeosClub,
 * que es justo lo que llevan las fichas sin dueño.
 */
function segunPlan<T extends {
  id?: string; plan?: string; plan_estado?: string | null; plan_hasta?: string | null;
  logo?: string; logo_url?: string | null; verificado?: boolean;
}>(
  x: T,
  reglasActivas: boolean,
  caidos: Set<string> = new Set()
): T {
  if (!reglasActivas) return x;
  // Un plan caducado o impagado cae al nivel básico (ver `puedeSiActivo`).
  // `plan_estado` y `plan_hasta` NO son públicos (lote 33: son información
  // comercial) y no se pueden pedir en las consultas anónimas: la consulta
  // entera fallaría con "permission denied". Por eso, cuando no vienen en la
  // fila, se usa la lista de locales con el plan caído que da el lote 47.
  const suscripcion = x.plan_estado !== undefined
    ? { estado: x.plan_estado, hasta: x.plan_hasta ?? null }
    : x.id && caidos.has(x.id) ? { estado: "impago", hasta: null } : undefined;
  const conLogo = puedeSiActivo(x.plan, "logoEnElMapa", true, suscripcion);
  const conSello = puedeSiActivo(x.plan, "selloVerificado", true, suscripcion);
  return {
    ...x,
    ...(conLogo ? {} : { logo: undefined, logo_url: null }),
    ...(conSello ? {} : { verificado: false }),
  };
}

/**
 * Ids de locales con un plan de pago caducado o impagado (función SQL del lote
 * 47). Solo se pide cuando las reglas están encendidas. Si el lote aún no está
 * pegado, o falla, queda vacío: se comporta como hasta ahora y no rompe nada.
 */
const memoCaidos = memo("planes-caidos", async (): Promise<Set<string>> => {
  const { data, error } = await supabase.rpc("locales_con_plan_caido");
  if (error) {
    registrar("planes", "no se pudo leer qué planes han caducado (¿falta el lote 47?)", error);
    return new Set<string>();
  }
  return new Set<string>(((data ?? []) as (string | { locales_con_plan_caido?: string })[])
    .map((x) => (typeof x === "string" ? x : x?.locales_con_plan_caido))
    .filter((x): x is string => Boolean(x)));
});

async function caidosSiReglas(reglas: boolean): Promise<Set<string>> {
  return reglas ? memoCaidos.get() : new Set<string>();
}

/** Aplica las reglas del plan al local de cada tardeo (fichas, listados de DJ, favoritos…). */
async function conReglasDePlan(ts: Tardeo[]): Promise<Tardeo[]> {
  const reglas = await planesActivos();
  if (!reglas) return ts;
  const caidos = await caidosSiReglas(reglas);
  return ts.map((t) => ({ ...t, local: segunPlan(t.local, reglas, caidos) }));
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
      plan: loc.plan ?? "basic",
      adn: {
        ambiente: Array.isArray(loc.ambiente) ? loc.ambiente : [],
        musica: Array.isArray(loc.musica) ? loc.musica : [],
        publico: Array.isArray(loc.publico) ? loc.publico : [],
        dressCode: loc.dress_code ?? undefined,
        tipoLocal: loc.tipo_local ?? undefined,
      },
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
    urlEntradas: r.fourvenues_url ?? undefined,
    urlPromos: r.promo_url ?? undefined,
    descripcion: r.descripcion ?? undefined,
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
    destacadoOrden: r.destacado_orden ?? null,
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
/**
 * ¿Este tardeo trae su local, o se lo ha comido la seguridad de fila?
 *
 * Un local que no está `activo` desaparece de las consultas públicas: la fila
 * del tardeo llega, pero `locales` viene a null y `mapRow` lo convierte en un
 * local con nombre vacío. Resultado: una tarjeta sin nombre de sitio, sin logo
 * y con un enlace a una ficha que para quien no ha entrado no existe.
 *
 * Pasó de verdad. Un solo local en borrador dejaba así CUATRO de las cinco
 * tarjetas de la portada, y desde fuera no parecía un local sin aprobar:
 * parecía que la web estaba rota.
 *
 * Se filtran en las consultas PÚBLICAS y solo ahí. En el panel del local o del
 * admin el tardeo tiene que seguir viéndose —es suyo, y hay que poder
 * arreglarlo—, y ahí el local sí llega porque quien mira tiene permiso.
 */
const conLocalVisible = (t: Tardeo): boolean => Boolean(t.local.nombre);

async function leerTardeosPublicados(): Promise<Tardeo[]> {
  try {
    const { data, error } = await supabase
      .from("tardeos")
      .select(SELECT)
      .or(A_LA_VISTA())
      .gte("fecha", hoyISO())
      .lte("fecha", horizonteISO())
      .order("fecha", { ascending: true });
    if (error) throw error;
    const reglas = await planesActivos();
    const caidos = await caidosSiReglas(reglas);
    const todos = (data ?? []).map(mapRow);
    const visibles = todos.filter(conLocalVisible);
    // Se deja constancia: un tardeo escondido por su local es un local sin
    // aprobar, y eso hay que verlo en los registros del servidor, no
    // descubrirlo mirando la portada.
    if (visibles.length < todos.length) {
      avisar("tardeos",
        `${todos.length - visibles.length} tardeo(s) fuera del listado público: su local no está activo`);
    }
    return visibles.map((t) => ({ ...t, local: segunPlan(t.local, reglas, caidos) }));
  } catch (e) {
    registrar("tardeos", "no se pudo cargar el listado público", e);
    // En build hay que reventar. Devolver [] aquí hornea la portada, /tardeos
    // y /mapa vacías y `next build` termina en verde: se despliega una web sin
    // contenido y nadie se entera hasta que un usuario la abre. Pasó de verdad.
    // En ejecución es lo contrario: una lista vacía se recupera al revalidar,
    // y es mejor que enseñarle un 500 a quien está mirando.
    if (process.env.NEXT_PHASE === "phase-production-build") throw e;
    return [];
  }
}

export function getTardeosPublicados(): Promise<Tardeo[]> {
  return memoTardeos.get();
}

/**
 * Los publicados MÁS ALLÁ del mes de vista, para una sección aparte ("Más
 * adelante").
 *
 * La ventana de 30 días sigue mandando en listado, mapa y recomendaciones.
 * Pero cuando el mes viene flojo, la web decía "no hay tardeos" teniendo
 * fiestas anunciadas para dentro de dos meses, y eso parece una web muerta.
 * Se enseñan aparte y con la fecha bien visible, sin mezclarlas con lo de
 * este mes.
 */
async function leerTardeosMasAdelante(limite: number): Promise<Tardeo[]> {
  try {
    const { data, error } = await supabase
      .from("tardeos")
      .select(SELECT)
      .or(A_LA_VISTA())
      .gt("fecha", horizonteISO())
      .order("fecha", { ascending: true })
      .limit(limite);
    if (error) throw error;
    const reglas = await planesActivos();
    const caidos = await caidosSiReglas(reglas);
    return (data ?? []).map(mapRow).filter(conLocalVisible)
      .map((t) => ({ ...t, local: segunPlan(t.local, reglas, caidos) }));
  } catch (e) {
    registrar("tardeos", "no se pudo cargar «más adelante»", e);
    return [];
  }
}

export function getTardeosMasAdelante(limite = 12): Promise<Tardeo[]> {
  return memoMasAdelante.get().then((l) => l.slice(0, limite));
}

/**
 * Directorio público de locales y promotores.
 *
 * Solo activos. Los destacados salen primero, en el orden del admin; el resto,
 * los verificados por delante y luego alfabético, que en un listado de negocios
 * es lo que la gente espera.
 */
async function leerLocalesPublicos(): Promise<any[]> {
  // Por bloques de 1.000 (el tope de PostgREST por petición): sin esto, a
  // partir del local 1.001 el directorio se cortaba en silencio. `id` desempata
  // para que los bloques no repitan ni se salten filas.
  const data: any[] = [];
  let error: unknown = null;
  for (let desde = 0; desde < 20000; desde += 1000) {
    const r = await supabase
      .from("locales")
      .select("id,nombre,zona,direccion,logo_url,tipo,verificado,destacado_orden,plan")
      .eq("estado", "activo")
      .order("destacado_orden", { ascending: true, nullsFirst: false })
      .order("verificado", { ascending: false })
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, desde + 999);
    if (r.error) { error = r.error; break; }
    data.push(...(r.data ?? []));
    if ((r.data ?? []).length < 1000) break;
  }
  if (error) registrar("locales", "no se pudo cargar el directorio", error);
  const reglas = await planesActivos();
  const caidos = await caidosSiReglas(reglas);
  return (data ?? []).map((l) => segunPlan(l as any, reglas, caidos));
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
    .select("id,nombre,zona,logo_url,tipo,verificado,destacado_orden,plan,descripcion")
    .eq("estado", "activo")
    .not("destacado_orden", "is", null)
    .order("destacado_orden", { ascending: true })
    .limit(limite);
  if (error) registrar("locales", "no se pudieron cargar los destacados", error);
  const reglas = await planesActivos();
  const caidos = await caidosSiReglas(reglas);
  if (data?.length) return { locales: data.map((l) => segunPlan(l as any, reglas, caidos)), sonDePago: true };

  // Nadie destacado todavía: en vez de dejar el hueco, se enseñan los locales
  // que tienen tardeos publicados. Son los que están vivos, que es lo que le
  // interesa a quien entra. El que llama cambia el título para no llamar
  // "destacado" a algo que nadie ha pagado.
  const hoy = hoyISO();
  const { data: conTardeos } = await supabase
    .from("tardeos")
    .select("locales(id,nombre,zona,logo_url,tipo,verificado,plan,descripcion)")
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
  return { locales: locales.map((l) => segunPlan(l as any, reglas, caidos)), sonDePago: false };
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
    // `owner_id` solo para saber si la ficha tiene dueño, y no baja al
    // navegador: lo que sale de aquí es un booleano, no el identificador de
    // una persona.
    .select("id,nombre,descripcion,direccion,lat,lng,zona,telefono,redes,fotos,horarios,verificado,estado,logo_url,tipo,playlist_url,owner_id,plan,tipo_local,aforo,espacios,ambiente,publico,dress_code,musica,horario_habitual")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { owner_id, ...resto } = data as Record<string, unknown>;
  const reglas = await planesActivos();
  const caidos = await caidosSiReglas(reglas);
  return { ...segunPlan(resto as any, reglas, caidos), id, sinDueno: owner_id == null };
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
  return conReglasDePlan((data ?? []).map(mapRow));
}

/**
 * Actualiza campos del local (fotos, descripción, teléfono…).
 *
 * Devuelve las filas tocadas en `data`: sin permiso la base NO da error,
 * filtra la fila y actualiza cero, así que hay que mirar lo que devuelve para
 * no enseñar "guardado" cuando no se ha guardado nada.
 */
export async function updateMiLocal(id: string, fields: Record<string, unknown>) {
  return supabase.from("locales").update(fields).eq("id", id).select("id");
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

/**
 * Columnas de la ficha tal como la ve su dueño (o un admin) en el panel.
 *
 * Explícitas y no `*`: con `*` cualquier columna que el rol no pueda leer hace
 * fallar la consulta entera, y el dueño se queda sin su local. Pasó con
 * `email` al restringirla en el lote 14.
 *
 * `email` va aquí y NO en la ficha pública: el lote 14 se lo quitó a `anon`,
 * pero el dueño entra como `authenticated` y sí puede leer el suyo. Es su
 * contacto y tiene que poder cambiarlo desde el editor.
 */
const COLS_MI_LOCAL =
  "id,nombre,descripcion,direccion,lat,lng,zona,codigo_postal,telefono,email,redes,fotos,horarios,verificado,estado,logo_url,tipo,owner_id,plan,plan_estado,plan_hasta,playlist_url,tipo_local,aforo,espacios,ambiente,publico,dress_code,musica,horario_habitual";

/** El primer local del usuario (owner). Devuelve la fila cruda o null. */
export async function getMiLocal(ownerId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("locales")
    .select(COLS_MI_LOCAL)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  // Antes el error se tragaba en silencio y devolvía null, que la app
  // interpreta como "no tienes local": el dueño creaba otro y acababa con
  // duplicados. Sigue devolviendo null (cinco sitios la llaman y varios sin
  // catch), pero al menos deja rastro de que fue un fallo y no una ausencia.
  if (error) registrar("locales", "no se pudo cargar el local del dueño", error);
  return data ?? null;
}

/**
 * TODAS las fichas del usuario: hay quien tiene un local y además organiza
 * fuera como promotor. `getMiLocal` solo daba la primera, así que la segunda
 * no se podía gestionar desde ningún sitio.
 *
 * Devuelve el error aparte para que el panel distinga "no tienes ficha" de
 * "no se ha podido leer" y no invite a crear un duplicado por un fallo de red.
 */
export async function getMisLocales(ownerId: string): Promise<{ fichas: any[]; error: string | null }> {
  const { data, error } = await supabase
    .from("locales")
    .select(COLS_MI_LOCAL)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) {
    registrar("locales", "no se pudieron cargar las fichas del dueño", error);
    return { fichas: [], error: error.message };
  }
  return { fichas: data ?? [], error: null };
}

/** Una ficha cualquiera por id, con las columnas del panel. Para el admin, que
 *  edita fichas ajenas (RLS le deja); a cualquier otro le devuelve null. */
export async function getLocalParaPanel(id: string): Promise<any | null> {
  const { data, error } = await supabase.from("locales").select(COLS_MI_LOCAL).eq("id", id).maybeSingle();
  if (error) registrar("locales", "no se pudo cargar una ficha para el panel", error);
  return data ?? null;
}

/** «Esa función no existe» (42883 en la base, PGRST202 en la API). */
const faltaFuncion = (e: { code?: string } | null | undefined) => e?.code === "42883" || e?.code === "PGRST202";

/**
 * Métricas de un local (visitas totales + inscritos activos). Requiere Lote 5.
 *
 * Devuelve también `error`: antes un fallo se tragaba y el panel enseñaba
 * «0 visitas», que el local se cree. Un cero falso es peor que un aviso.
 */
export async function getMetricasLocal(localId: string): Promise<{ visitas: number; inscritos: number; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("metricas_de_local", { p_local: localId });
    if (error) {
      return { visitas: 0, inscritos: 0, error: faltaFuncion(error) ? "Falta pegar el lote 5 de métricas en la base." : error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { visitas: Number(row?.visitas ?? 0), inscritos: Number(row?.inscritos ?? 0), error: null };
  } catch (e) {
    return { visitas: 0, inscritos: 0, error: (e as Error)?.message || "No se pudieron cargar las cifras." };
  }
}

/** Una fila de `inscritos_de_local` (lote 8). */
export type InscritoLocal = { tardeo_id: string; tardeo_titulo: string; fecha: string; nombre: string; apuntado_en: string };

/**
 * Lista de apuntados a los tardeos de un local (con nombre). Requiere Lote 8.
 * Con `error` por lo mismo que las métricas: «nadie apuntado» y «no se ha
 * podido leer» no pueden verse igual.
 */
export async function getInscritosLocal(localId: string): Promise<{ filas: InscritoLocal[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("inscritos_de_local", { p_local: localId });
    if (error) {
      return { filas: [], error: faltaFuncion(error) ? "Falta pegar el lote 8 (apuntados) en la base." : error.message };
    }
    return { filas: (data ?? []) as InscritoLocal[], error: null };
  } catch (e) {
    return { filas: [], error: (e as Error)?.message || "No se pudieron cargar los apuntados." };
  }
}

/** Un DJ del directorio, para el autocompletar del formulario de tardeo. */
export type DjDirectorio = { id: string; nombre_artistico: string; avatar_url: string | null; verificado: boolean | null };

/**
 * DJs públicos cuyo nombre contiene `texto`. Pocos y del servidor: el
 * directorio tiene cientos y solo hacen falta los que encajan con lo tecleado.
 */
export async function buscarDjsDirectorio(texto: string, limite = 6): Promise<DjDirectorio[]> {
  // Los comodines y comas de PostgREST se quitan: el texto lo teclea cualquiera.
  const t = texto.trim().replace(/[%_,()*]/g, " ").replace(/\s+/g, " ");
  if (t.length < 2) return [];
  const { data, error } = await supabase
    .from("djs")
    .select("id,nombre_artistico,avatar_url,verificado")
    .eq("oculto", false)
    .ilike("nombre_artistico", `%${t}%`)
    .order("verificado", { ascending: false })
    .limit(limite);
  if (error) return [];
  return (data ?? []) as DjDirectorio[];
}

/** Cifras de un tardeo concreto en el periodo. */
export type MetricaTardeo = { tardeo_id: string; titulo: string; fecha: string; visitas: number; clics: number; guardados: number };

/**
 * Visitas, clics a comprar y guardados de cada tardeo del local (últimos
 * `dias`). Usa la función del lote 54; si aún no está pegada, cuenta a mano
 * sobre `eventos_metrica` con un tope de filas y lo dice (`aproximado`), para
 * no enseñar como exacto lo que puede estar cortado.
 */
export async function getMetricasPorTardeo(
  localId: string, dias: number,
): Promise<{ filas: MetricaTardeo[]; error: string | null; aproximado: boolean }> {
  const { data, error } = await supabase.rpc("metricas_por_tardeo", { p_local: localId, p_dias: dias });
  if (!error) {
    return {
      filas: ((data ?? []) as MetricaTardeo[]).map((f) => ({
        ...f, visitas: Number(f.visitas ?? 0), clics: Number(f.clics ?? 0), guardados: Number(f.guardados ?? 0),
      })),
      error: null, aproximado: false,
    };
  }
  if (!faltaFuncion(error)) return { filas: [], error: error.message, aproximado: false };

  // Respaldo: eventos de los tardeos de este local. RLS ya deja leer solo lo propio.
  const TOPE = 5000;
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const { data: ev, error: e2 } = await supabase
    .from("eventos_metrica")
    .select("tipo,tardeo_id,tardeos!inner(local_id,titulo,fecha)")
    .eq("tardeos.local_id", localId)
    .in("tipo", ["vista_tardeo", "clic_entrada", "clic_lista", "favorito"])
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(TOPE);
  if (e2) return { filas: [], error: e2.message, aproximado: false };
  const m = new Map<string, MetricaTardeo>();
  for (const r of (ev ?? []) as any[]) {
    const t = Array.isArray(r.tardeos) ? r.tardeos[0] : r.tardeos;
    if (!r.tardeo_id || !t) continue;
    const f = m.get(r.tardeo_id) ?? { tardeo_id: r.tardeo_id, titulo: t.titulo, fecha: t.fecha, visitas: 0, clics: 0, guardados: 0 };
    if (r.tipo === "vista_tardeo") f.visitas++;
    else if (r.tipo === "favorito") f.guardados++;
    else f.clics++;
    m.set(r.tardeo_id, f);
  }
  const filas = [...m.values()].sort((a, b) => b.visitas - a.visitas);
  return { filas, error: null, aproximado: (ev ?? []).length >= TOPE };
}

/**
 * Aplica `campos` a los tardeos de la misma serie con fecha POSTERIOR a
 * `desdeFecha` (lote 53, columna `serie_id`). Devuelve cuántos se tocaron.
 */
export async function aplicarASerie(
  serieId: string, desdeFecha: string, campos: Record<string, unknown>,
): Promise<{ n: number; error: string | null }> {
  invalidarCacheTardeos();
  const { data, error } = await supabase.from("tardeos").update(campos)
    .eq("serie_id", serieId).gt("fecha", desdeFecha).select("id");
  if (error) return { n: 0, error: error.message };
  return { n: data?.length ?? 0, error: null };
}

/** Cuántos tardeos de la serie quedan después de `desdeFecha`. */
export async function contarSiguientesDeSerie(serieId: string, desdeFecha: string): Promise<number> {
  const { count, error } = await supabase.from("tardeos").select("id", { count: "exact", head: true })
    .eq("serie_id", serieId).gt("fecha", desdeFecha);
  return error ? 0 : (count ?? 0);
}

/** ¿El error es «esa columna no existe»? (42703 en la base, PGRST204 en la API). */
export function falloPorColumna(e: { code?: string; message?: string } | null | undefined, columna: string): boolean {
  if (!e) return false;
  return e.code === "42703" || e.code === "PGRST204" || (e.message ?? "").includes(columna);
}

/** Lista pública de DJs (no ocultos), ordenados por reputación. */
async function leerDjsPublicos(): Promise<any[]> {
  // Por bloques de 1.000 (tope de PostgREST): antes el DJ 1.001 no salía nunca.
  const data: any[] = [];
  for (let desde = 0; desde < 20000; desde += 1000) {
    const r = await supabase
      .from("djs")
      .select("id,nombre_artistico,estilos,avatar_url,verificado,reputacion_score,destacado_orden")
      .eq("oculto", false)
      // Los destacados mandan y en el orden que fijó el admin (1, 2, 3…).
      // nullsFirst: false deja detrás a los que no lo están; entre ellos sigue
      // decidiendo la reputación de siempre. `id` desempata entre bloques.
      .order("destacado_orden", { ascending: true, nullsFirst: false })
      .order("verificado", { ascending: false })
      .order("reputacion_score", { ascending: false })
      .order("id", { ascending: true })
      .range(desde, desde + 999);
    if (r.error) { registrar("djs", "no se pudo cargar la lista de DJs", r.error); break; }
    data.push(...(r.data ?? []));
    if ((r.data ?? []).length < 1000) break;
  }
  return data;
}

/** Tardeos publicados y no expirados en los que pincha un DJ. */
export async function getTardeosPublicadosDeDj(djId: string): Promise<Tardeo[]> {
  const hoy = hoyISO();
  const horizonte = horizonteISO();
  const ahora = Date.now();
  const { data } = await supabase
    .from("tardeo_djs")
    .select(`tardeos(${SELECT})`)
    .eq("dj_id", djId);
  const filas = (data ?? [])
    .map((r: any) => r.tardeos)
    // Mismo criterio que `A_LA_VISTA` y el mismo horizonte que los demás
    // listados: publicados, y programados a los que ya les llegó la hora.
    .filter((t: any) =>
      t &&
      (t.estado === "publicado" ||
        (t.estado === "programado" && t.publicar_en && new Date(t.publicar_en).getTime() <= ahora)) &&
      t.fecha >= hoy && t.fecha <= horizonte)
    .map(mapRow)
    // Misma razón que en el listado: aquí también es una pantalla pública.
    .filter(conLocalVisible)
    .sort((a: Tardeo, b: Tardeo) => a.fecha.localeCompare(b.fecha));
  return conReglasDePlan(filas);
}

/** Sube el PressKit del DJ al Storage y devuelve la URL pública. */
export async function subirPressKitDj(id: string, file: File): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
  const ruta = `presskits/${id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("flyers").upload(ruta, file, {
    contentType: file.type || "application/pdf",
    upsert: true,
  });
  if (error) return null;
  return supabase.storage.from("flyers").getPublicUrl(ruta).data.publicUrl;
}

/**
 * Actualiza el perfil de un DJ (bio, estilos, avatar…). Devuelve las filas
 * tocadas: si la RLS no deja escribir, Supabase no da error sino 0 filas, y
 * quien llama debe comprobarlo para no decir "guardado" en falso.
 */
export async function updateMiDj(id: string, fields: Record<string, unknown>) {
  return supabase.from("djs").update(fields).eq("id", id).select("id");
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
export async function vincularDjsPorNombre(tardeoIds: string | string[], nombres: string[]): Promise<EnlaceDjs> {
  const ids = Array.isArray(tardeoIds) ? tardeoIds : [tardeoIds];
  const limpios = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))];
  if (limpios.length === 0 || ids.length === 0) return { enlazados: [], sinFicha: [] };

  // El "DJ" se quita esté delante o detrás: en las fichas está de las dos
  // formas ("Dj Taño", "German Navarro DJ") y en los flyers, de cualquiera.
  const clave = (s: string) => plegar(s).replace(/^dj\s+/, "").replace(/\s+dj$/, "").trim();

  // La tabla de DJs se lee UNA vez para toda la serie. Antes se llamaba a esta
  // función por cada fecha (hasta 52 en una serie semanal de un año) y cada
  // llamada se bajaba la tabla entera otra vez.
  // Solo id y nombre, y por bloques de 1.000: con más DJs que el tope de
  // PostgREST, los de más allá no casaban nunca.
  const data: any[] = [];
  for (let desde = 0; desde < 50000; desde += 1000) {
    const r = await supabase.from("djs").select("id,nombre_artistico").order("id").range(desde, desde + 999);
    data.push(...(r.data ?? []));
    if (r.error || (r.data ?? []).length < 1000) break;
  }
  const fichados = data.map((d: any) => ({ ...d, clave: clave(d.nombre_artistico || "") }));

  const enlazados: string[] = [];
  const sinFicha: string[] = [];
  const djIds: string[] = [];

  for (const n of limpios) {
    const dj = fichados.find((d) => d.clave && d.clave === clave(n));
    if (dj) { enlazados.push(n); djIds.push(dj.id); }
    else sinFicha.push(n);
  }

  // Y una sola escritura con todas las filas (tardeo × DJ).
  const filas = ids.flatMap((tardeo_id) => djIds.map((dj_id) => ({ tardeo_id, dj_id })));
  if (filas.length) await supabase.from("tardeo_djs").upsert(filas, { onConflict: "tardeo_id,dj_id" });
  return { enlazados, sinFicha };
}

/**
 * Deja los DJs de un tardeo como dice la lista de nombres, tocando solo lo que
 * cambia.
 *
 * Antes se borraban todos y se volvían a enlazar por nombre. Problemas: si el
 * re-enlace fallaba, el tardeo se quedaba sin DJs; y los DJs que el usuario no
 * puede ver (ficha oculta por RLS) no salían en el campo, así que guardar los
 * borraba sin que nadie lo hubiera pedido. Ahora se quitan solo los que ya no
 * están, se añaden solo los nuevos y los no visibles se conservan.
 *
 * Lanza un Error legible si falla la lectura o alguna escritura.
 */
export async function setDjsDeTardeo(tardeoId: string, nombres: string[]): Promise<EnlaceDjs> {
  // La misma comparación que vincularDjsPorNombre (sin tildes, sin el «DJ»).
  const clave = (s: string) => plegar(s).replace(/^dj\s+/, "").replace(/\s+dj$/, "").trim();
  const limpios = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))];
  const deseadas = new Set(limpios.map(clave).filter(Boolean));

  const { data: actuales, error: eA } = await supabase
    .from("tardeo_djs").select("dj_id, djs(id,nombre_artistico)").eq("tardeo_id", tardeoId);
  if (eA) throw new Error(`No se pudieron leer los DJs del tardeo: ${eA.message}`);

  // Sin la ficha unida (`djs` nulo) es un DJ que no podemos ver: se conserva.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visibles = (actuales ?? []).map((r: any) => ({ dj_id: r.dj_id as string, dj: Array.isArray(r.djs) ? r.djs[0] : r.djs }))
    .filter((r) => r.dj)
    .map((r) => ({ dj_id: r.dj_id, nombre: String(r.dj.nombre_artistico ?? ""), clave: clave(String(r.dj.nombre_artistico ?? "")) }));

  const quitar = visibles.filter((v) => !deseadas.has(v.clave)).map((v) => v.dj_id);
  const seQuedan = visibles.filter((v) => deseadas.has(v.clave));
  const clavesQueSeQuedan = new Set(seQuedan.map((v) => v.clave));

  if (quitar.length) {
    const { error: eD } = await supabase.from("tardeo_djs").delete().eq("tardeo_id", tardeoId).in("dj_id", quitar);
    if (eD) throw new Error(`No se pudieron quitar los DJs: ${eD.message}`);
  }

  // Lo nuevo: nombres que no corresponden a ninguno de los que ya estaban.
  const nuevos = limpios.filter((n) => !clavesQueSeQuedan.has(clave(n)));
  const enlazados = seQuedan.map((v) => v.nombre);
  const sinFicha: string[] = [];
  if (nuevos.length) {
    // Por bloques de 1.000 (tope de PostgREST), como en vincularDjsPorNombre.
    const fichas: { id: string; nombre_artistico: string | null }[] = [];
    for (let desde = 0; desde < 50000; desde += 1000) {
      const { data: bloque, error: eF } = await supabase.from("djs").select("id,nombre_artistico").order("id").range(desde, desde + 999);
      if (eF) throw new Error(`No se pudo buscar a los DJs: ${eF.message}`);
      fichas.push(...((bloque ?? []) as { id: string; nombre_artistico: string | null }[]));
      if ((bloque ?? []).length < 1000) break;
    }
    const fichados = fichas.map((d) => ({ id: d.id as string, clave: clave(d.nombre_artistico || "") }));
    const ids: string[] = [];
    for (const n of nuevos) {
      const dj = fichados.find((d) => d.clave && d.clave === clave(n));
      if (dj) { enlazados.push(n); if (!ids.includes(dj.id)) ids.push(dj.id); }
      else sinFicha.push(n);
    }
    if (ids.length) {
      const { error: eU } = await supabase.from("tardeo_djs")
        .upsert(ids.map((dj_id) => ({ tardeo_id: tardeoId, dj_id })), { onConflict: "tardeo_id,dj_id" });
      if (eU) throw new Error(`No se pudieron añadir los DJs: ${eU.message}`);
    }
  }
  return { enlazados, sinFicha };
}

/** Las pestañas de "Mis tardeos" ("cerrados" = cancelados y finalizados). */
export type FiltroTardeos = "proximos" | "pasados" | "borradores" | "cerrados";

/** Búsqueda y rango de fechas opcionales de "Mis tardeos" (se filtran en el servidor). */
export type BusquedaTardeosLocal = { texto?: string; desde?: string; hasta?: string };

/**
 * Tardeos de un local (cualquier estado), para el panel, de página en página.
 *
 * Antes se pedían todos de golpe: el paraguas "TardeosClub" tiene casi 400 y
 * PostgREST corta a 1000, así que un local grande acabaría viendo una lista a
 * medias sin saberlo. Devuelve la forma que espera `usePaginado`.
 *
 *  - Próximos: de hoy en adelante y ya publicados o programados (lo que va a
 *    salir), del más cercano al más lejano.
 *  - Pasados: lo de antes de hoy, del más reciente hacia atrás.
 *  - Borradores: lo guardado sin publicar, sea de la fecha que sea.
 */
export async function getTardeosDeLocal(
  localId: string, filtro: FiltroTardeos, desde: number, hasta: number, busqueda: BusquedaTardeosLocal = {},
): Promise<{ data: Tardeo[] | null; count: number | null; error: { message: string } | null }> {
  const hoy = hoyISO();
  let q = supabase.from("tardeos").select(SELECT, { count: "exact" }).eq("local_id", localId);
  // Título (sin caracteres que rompan el filtro de PostgREST) y rango de días.
  const texto = (busqueda.texto ?? "").replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
  if (texto) q = q.ilike("titulo", `%${texto}%`);
  if (busqueda.desde) q = q.gte("fecha", busqueda.desde);
  if (busqueda.hasta) q = q.lte("fecha", busqueda.hasta);
  // "Próximos" y "Pasados" son los que están (o estuvieron) a la vista:
  // publicados o programados. Los cancelados/finalizados no se cuentan como
  // próximos (antes salían, y hasta se podía pedir destacar uno cancelado).
  // .order("id") de desempate para que la paginación no repita filas.
  const vivos = ["publicado", "programado"];
  if (filtro === "proximos") q = q.gte("fecha", hoy).in("estado", vivos).order("fecha", { ascending: true }).order("hora_inicio", { ascending: true }).order("id");
  else if (filtro === "pasados") q = q.lt("fecha", hoy).in("estado", vivos).order("fecha", { ascending: false }).order("id");
  // Cerrados: cancelados y finalizados, del más reciente hacia atrás. Antes no
  // salían en ninguna pestaña y el local no podía ver qué había cancelado.
  else if (filtro === "cerrados") q = q.in("estado", ["cancelado", "finalizado"]).order("fecha", { ascending: false }).order("id");
  else q = q.eq("estado", "borrador").order("fecha", { ascending: true }).order("id");
  const { data, count, error } = await q.range(desde, hasta);
  return { data: data ? data.map(mapRow) : null, count, error };
}

/** Cuántos hay en cada pestaña, para los contadores. Tres cuentas sin filas. */
export async function contarTardeosDeLocal(localId: string): Promise<Record<FiltroTardeos, number | null>> {
  const hoy = hoyISO();
  const base = () => supabase.from("tardeos").select("id", { count: "exact", head: true }).eq("local_id", localId);
  const [p, a, b, c] = await Promise.all([
    base().gte("fecha", hoy).in("estado", ["publicado", "programado"]),
    base().lt("fecha", hoy).in("estado", ["publicado", "programado"]),
    base().eq("estado", "borrador"),
    base().in("estado", ["cancelado", "finalizado"]),
  ]);
  return { proximos: p.count ?? null, pasados: a.count ?? null, borradores: b.count ?? null, cerrados: c.count ?? null };
}

/** Los tardeos de un local entre dos fechas (YYYY-MM-DD), para el calendario
 *  del mes. Un mes de un local cabe holgado en una petición. */
export async function getTardeosDeLocalEnRango(localId: string, desde: string, hasta: string): Promise<Tardeo[]> {
  const { data, error } = await supabase.from("tardeos").select(SELECT)
    .eq("local_id", localId).gte("fecha", desde).lte("fecha", hasta)
    .order("fecha", { ascending: true }).limit(500);
  if (error) registrar("tardeos", "no se pudo cargar el calendario del local", error);
  return (data ?? []).map(mapRow);
}

/** Un tardeo por id. Sin filtrar por local visible: esta la usa también el
 *  editor, y el dueño tiene que poder abrir el suyo aunque su ficha esté sin
 *  aprobar. Quien decide qué se enseña es la pantalla. */
export async function getTardeoById(id: string): Promise<Tardeo | null> {
  try {
    const { data, error } = await supabase.from("tardeos").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [t] = await conReglasDePlan([mapRow(data)]);
    return t;
  } catch (e) {
    registrar("tardeos", "no se pudo cargar la ficha de un tardeo", e);
    return null;
  }
}

// ---------- Favoritos ----------
export async function esFavorito(uid: string, tid: string): Promise<boolean> {
  const { data } = await supabase.from("favoritos").select("tardeo_id").eq("profile_id", uid).eq("tardeo_id", tid).maybeSingle();
  return !!data;
}
/** Devuelve `{ error }`: quien llama debe revertir su estado si hay error. */
export async function setFavorito(uid: string, tid: string, on: boolean): Promise<{ error: { message: string } | null }> {
  const r = on
    ? await supabase.from("favoritos").insert({ profile_id: uid, tardeo_id: tid })
    // Quitar uno que ya no estaba no es un fallo.
    : await supabase.from("favoritos").delete().eq("profile_id", uid).eq("tardeo_id", tid);
  // 23505: ya era favorito (doble toque): el resultado es el que se pedía.
  if (on && r.error?.code === "23505") return { error: null };
  return { error: r.error };
}
export async function getFavoritos(uid: string): Promise<Tardeo[]> {
  // Lanza si falla: una lista vacía por error parecería "no tienes guardados".
  const { data, error } = await supabase.from("favoritos").select(`tardeos(${SELECT})`).eq("profile_id", uid);
  if (error) throw error;
  return conReglasDePlan((data ?? []).map((r: any) => r.tardeos).filter(Boolean).map(mapRow));
}

// ---------- Inscripciones (tardeos gratis) ----------
export async function estaInscrito(uid: string, tid: string): Promise<boolean> {
  const { data } = await supabase.from("inscripciones").select("id").eq("profile_id", uid).eq("tardeo_id", tid).eq("estado", "apuntado").maybeSingle();
  return !!data;
}
// ---------- Plazas y asistencia (lote 48) ----------
export type Plazas = { aforo: number | null; apuntados: number; libres: number | null };

/**
 * Plazas de un tardeo. Devuelve null si el lote 48 aún no está en la base (o si
 * falla): la pantalla entonces no enseña plazas, igual que hasta ahora.
 */
export async function getPlazasTardeo(id: string): Promise<Plazas | null> {
  try {
    const { data, error } = await supabase.rpc("plazas_de_tardeo", { p_tardeo: id });
    if (error) return null;
    const f = Array.isArray(data) ? data[0] : data;
    if (!f) return null;
    return { aforo: f.aforo ?? null, apuntados: Number(f.apuntados ?? 0), libres: f.libres ?? null };
  } catch {
    return null;
  }
}

export type Inscrito = {
  inscripcion_id: string; nombre: string; estado: "apuntado" | "espera" | "cancelado";
  asistencia: "pendiente" | "asistio" | "no_asistio"; apuntado_en: string;
};

/** Quién se ha apuntado a un tardeo. Solo lo devuelve la base a su local o a un admin. */
export async function getInscritosTardeo(id: string): Promise<{ filas: Inscrito[]; error: string | null }> {
  const { data, error } = await supabase.rpc("inscritos_de_tardeo", { p_tardeo: id });
  if (error) {
    const falta = error.code === "42883" || error.code === "PGRST202";
    return { filas: [], error: falta ? "Falta pegar el lote 48 (supabase/48_reservas_aforo_asistencia.sql)." : error.message };
  }
  return { filas: (data ?? []) as Inscrito[], error: null };
}

/** Fila de la lista completa de un tardeo (lote 75: `lista_de_tardeo`). */
export type FilaLista = Inscrito & {
  /** Solo para admins; al local la base se lo da vacío. */
  email: string | null;
  espera_desde: string | null;
  /** Puesto en la lista de espera (1 = el siguiente en subir). */
  puesto: number | null;
};

/**
 * Lista completa de un tardeo para su ficha: confirmados, espera (con puesto) y
 * cancelados en una sola llamada. Sin el lote 75 se arma como antes, con
 * `inscritos_de_tardeo` + la fecha de espera leída aparte, para que la pantalla
 * funcione aunque el lote aún no esté pegado.
 */
export async function getListaTardeo(id: string): Promise<{ filas: FilaLista[]; error: string | null; sinLote75: boolean }> {
  const { data, error } = await supabase.rpc("lista_de_tardeo", { p_tardeo: id });
  if (!error) return { filas: (data ?? []) as FilaLista[], error: null, sinLote75: false };
  if (error.code !== "PGRST202" && error.code !== "42883") return { filas: [], error: error.message, sinLote75: false };
  const r = await getInscritosTardeo(id);
  if (r.error) return { filas: [], error: r.error, sinLote75: true };
  const ids = r.filas.filter((f) => f.estado === "espera").map((f) => f.inscripcion_id);
  const desde = new Map<string, string | null>();
  if (ids.length) {
    const { data: d } = await supabase.from("inscripciones").select("id,espera_desde").in("id", ids);
    for (const x of (d ?? []) as { id: string; espera_desde: string | null }[]) desde.set(x.id, x.espera_desde);
  }
  const enEspera = r.filas.filter((f) => f.estado === "espera")
    .map((f) => ({ ...f, espera_desde: desde.get(f.inscripcion_id) ?? f.apuntado_en }))
    .sort((a, b) => (a.espera_desde ?? "").localeCompare(b.espera_desde ?? "") || a.inscripcion_id.localeCompare(b.inscripcion_id));
  const puesto = new Map(enEspera.map((f, i) => [f.inscripcion_id, i + 1]));
  return {
    filas: r.filas.map((f) => ({ ...f, email: null, espera_desde: desde.get(f.inscripcion_id) ?? null, puesto: puesto.get(f.inscripcion_id) ?? null })),
    error: null, sinLote75: true,
  };
}

/**
 * Traduce los errores de gestionar la asistencia a algo que se entienda. Antes
 * del lote 75 la base solo deja al admin de la zona: al local le decía «Este
 * tardeo no es de tu zona», que no tiene sentido para él.
 */
function errorAsistencia(m: string): string {
  if (/no es de tu zona/i.test(m)) return "Para gestionar la espera desde aquí falta activar una mejora en la base de datos (lote 75). De momento, pídeselo al equipo.";
  if (/Aforo completo/i.test(m)) return "El aforo está completo: sube el aforo del tardeo o cancela a alguien para dar esta plaza.";
  return m;
}

/** Mover una inscripción: 'apuntado' (dar plaza), 'espera' o 'cancelado'. Admin de la zona o dueño del local (lote 75). */
export async function moverInscripcion(id: string, estado: "apuntado" | "espera" | "cancelado"): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_mover_inscripcion", { p_inscripcion: id, p_estado: estado });
  return { error: error ? errorAsistencia(error.message) : null };
}

/** Dar plaza al primero de la espera. Devuelve si había alguien. */
export async function promoverSiguiente(tardeoId: string): Promise<{ error: string | null; nadie: boolean }> {
  const { data, error } = await supabase.rpc("admin_promover_espera", { p_tardeo: tardeoId });
  if (error) return { error: errorAsistencia(error.message), nadie: false };
  return { error: null, nadie: !data };
}

export async function marcarAsistencia(
  inscripcionId: string, valor: "pendiente" | "asistio" | "no_asistio"
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc("marcar_asistencia", { p_inscripcion: inscripcionId, p_asistencia: valor });
  return { error };
}

export async function cancelarInscripcion(uid: string, tid: string): Promise<{ error: { message: string } | null }> {
  // Con `.select` se sabe cuántas filas cambiaron: si la política de la base no
  // deja tocar la fila, PostgREST no da error, solo 0 filas, y la pantalla
  // diría «cancelada» sin haberlo hecho.
  const { data, error } = await supabase.from("inscripciones").update({ estado: "cancelado" })
    .eq("profile_id", uid).eq("tardeo_id", tid).select("id");
  if (error) return { error };
  if (!data || data.length === 0) return { error: { message: "No se encontró tu plaza para cancelarla." } };
  return { error: null };
}
export async function getInscripciones(uid: string): Promise<Tardeo[]> {
  // Igual que getFavoritos: el error sube para que la pantalla lo enseñe.
  const { data, error } = await supabase.from("inscripciones").select(`tardeos(${SELECT})`).eq("profile_id", uid).eq("estado", "apuntado");
  if (error) throw error;
  return conReglasDePlan((data ?? []).map((r: any) => r.tardeos).filter(Boolean).map(mapRow));
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
const memoLocalesPublicos = memo("locales-publicos", () => leerLocalesPublicos());
const memoDjsPublicos = memo("djs-publicos", () => leerDjsPublicos());
const memoLocalesDestacados = memo("locales-destacados", () => leerLocalesDestacados(10));

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

// ---------------------------------------------------------------------------
// Lote 68 (equipo E): duplicados, DJ provisional. Solo funciones nuevas.
// ---------------------------------------------------------------------------

/** Un tardeo que podría ser el mismo que se va a crear. */
export type PosibleDuplicado = {
  id: string; titulo: string; fecha: string; hora_inicio: string | null;
  estado: string; local_nombre: string; mismo_local: boolean;
};

/** ¿Falta el lote 68? (función o tabla inexistente). */
export const faltaLote68 = (e: { code?: string } | null | undefined) =>
  !!e && ["PGRST202", "PGRST205", "42883", "42P01"].includes(e.code ?? "");

/**
 * Busca tardeos parecidos (mismo local o a pocos metros, misma fecha, título
 * parecido) ANTES de crear. Si el lote 68 no está, devuelve vacío: no se
 * bloquea la publicación por no poder comprobarlo.
 */
export async function buscarDuplicados(p: {
  localId: string; fechas: string[]; titulo: string; lat?: number | null; lng?: number | null; excluir?: string | null;
}): Promise<{ filas: PosibleDuplicado[]; falta: boolean }> {
  if (!p.titulo.trim() || p.fechas.length === 0) return { filas: [], falta: false };
  const { data, error } = await supabase.rpc("posibles_duplicados", {
    p_local: p.localId, p_fechas: p.fechas, p_titulo: p.titulo,
    p_lat: p.lat ?? null, p_lng: p.lng ?? null, p_excluir: p.excluir ?? null,
  });
  if (error) {
    if (!faltaLote68(error)) registrar("tardeos", "no se pudieron buscar duplicados", error);
    return { filas: [], falta: faltaLote68(error) };
  }
  return { filas: (data ?? []) as PosibleDuplicado[], falta: false };
}

/**
 * Crea (o reutiliza si ya existe con ese nombre) la ficha PROVISIONAL de un DJ
 * que no está en el directorio. Queda para revisión del equipo.
 */
export async function crearDjProvisional(nombre: string): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("crear_dj_provisional", { p_nombre: nombre });
  if (error) return { id: null, error: faltaLote68(error) ? "Falta el lote 68 para crear DJs nuevos desde aquí." : error.message };
  return { id: data as string, error: null };
}

// ---------- Próxima Parada (v2, equipo A) ----------
export type PlanGuardado = { tardeo: Tardeo; guardado: boolean; estado: "apuntado" | "espera" | null };

/**
 * Guardados + Asistiré (confirmado o en espera) de una persona, sin repetir.
 * Lanza si falla: una lista vacía por error parecería "no tienes planes".
 */
export async function getProximaParada(uid: string): Promise<PlanGuardado[]> {
  const [fav, ins] = await Promise.all([
    supabase.from("favoritos").select(`tardeos(${SELECT})`).eq("profile_id", uid),
    supabase.from("inscripciones").select(`estado, tardeos(${SELECT})`).eq("profile_id", uid).in("estado", ["apuntado", "espera"]),
  ]);
  // Sin el lote 64 'espera' no existe: el filtro sigue valiendo.
  if (fav.error) throw fav.error;
  if (ins.error) throw ins.error;
  const mapa = new Map<string, PlanGuardado>();
  for (const r of (fav.data ?? []) as any[]) {
    if (!r.tardeos) continue;
    const t = mapRow(r.tardeos);
    mapa.set(t.id, { tardeo: t, guardado: true, estado: null });
  }
  for (const r of (ins.data ?? []) as any[]) {
    if (!r.tardeos) continue;
    const t = mapRow(r.tardeos);
    const previo = mapa.get(t.id);
    mapa.set(t.id, { tardeo: previo?.tardeo ?? t, guardado: Boolean(previo), estado: r.estado });
  }
  const conPlan = await conReglasDePlan([...mapa.values()].map((p) => p.tardeo));
  return [...mapa.values()].map((p, i) => ({ ...p, tardeo: conPlan[i] }))
    .sort((a, b) => a.tardeo.fecha.localeCompare(b.tardeo.fecha));
}
