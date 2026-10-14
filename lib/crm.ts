import { supabase } from "./supabase";
import type { Plan } from "./planes";

/**
 * El seguimiento comercial de los locales.
 *
 * Hay 68 fichas y 4 reclamadas. Las otras 64 las creó TardeosClub y hay que ir
 * a buscarlas una a una. Esto es la lista de a quién le toca hoy.
 *
 * LO QUE SE GUARDA Y LO QUE SE DEDUCE, que es la decisión que sostiene el resto:
 *
 *   Se guarda  ->  lo que hiciste tú:  contactado, interesado, notas, cuándo volver.
 *   Se deduce  ->  lo que pasó de verdad:  reclamado (owner_id), cliente (plan_estado).
 *
 * Copiar "reclamado" o "cliente" a la tabla de seguimiento sería más cómodo de
 * consultar y sería un error: a los dos meses el tablero diría "interesado" de
 * alguien que lleva tres meses pagando, y a partir de ahí ya no te fías de
 * ninguna fila. Lo que puede quedarse viejo, no se guarda.
 */

export const ESTADOS = [
  { k: "no_contactado", label: "Sin contactar" },
  { k: "contactado", label: "Contactado" },
  { k: "interesado", label: "Interesado" },
  { k: "no_interesado", label: "No le interesa" },
] as const;

export type EstadoCrm = (typeof ESTADOS)[number]["k"];

export const CANALES = ["instagram", "email", "telefono", "whatsapp", "presencial", "otro"] as const;
export type Canal = (typeof CANALES)[number];

export type Seguimiento = {
  estado: EstadoCrm;
  canal: Canal | null;
  notas: string | null;
  proximo_seguimiento: string | null;
  ultimo_contacto: string | null;
};

export type FichaCrm = {
  id: string;
  nombre: string;
  zona: string | null;
  /** Lo que hiciste tú. */
  seg: Seguimiento;
  /** Cuándo y quién tocó el seguimiento por última vez (solo lectura). */
  meta: { actualizado_en: string | null; actualizado_por: string | null };
  /** Lo que pasó de verdad, derivado y no guardado. */
  reclamado: boolean;
  plan: Plan;
  planEstado: string;
  /** Por dónde se le puede escribir. Vacío si no hay forma, que también se ve. */
  instagram: string | null;
  web: string | null;
  facebook: string | null;
  email: string | null;
  telefono: string | null;
  /** Dónde vende ya, sacado de su último tardeo con enlace. */
  entradas: string | null;
  ticketera: string | null;
  tardeos: number;
};

export const SEG_VACIO: Seguimiento = {
  estado: "no_contactado", canal: null, notas: null,
  proximo_seguimiento: null, ultimo_contacto: null,
};

/** Instagram viene de tres maneras: "@handle", "handle" y la URL entera. */
export function enlaceInstagram(v?: string | null): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://instagram.com/${s.replace(/^@/, "")}`;
}

/** Y las webs, la mitad sin protocolo: "www.loquesea.com" no es un enlace. */
export function enlaceWeb(v?: string | null): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/**
 * El teléfono, listo para marcar. Se quitan espacios y guiones, y se le pone el
 * prefijo a los nueve dígitos sueltos, que son la mitad de los que hay.
 *
 * No se valida más: hay un "72626363663" en la base que no es un teléfono de
 * nada, pero inventarse que un dato está mal y esconderlo es peor que
 * enseñarlo. Quien llame lo verá enseguida.
 */
export function enlaceTelefono(v?: string | null): string | null {
  const s = (v ?? "").replace(/[\s.\-()]/g, "");
  if (!s) return null;
  return `tel:${/^\d{9}$/.test(s) ? `+34${s}` : s}`;
}

/** El nombre de la ticketera a partir del enlace, para poder leerlo de un vistazo. */
export function nombreTicketera(url?: string | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.includes("fourvenues")) return "Fourvenues";
    if (h.includes("stripe")) return "Stripe";
    if (h.includes("entradium")) return "Entradium";
    if (h.includes("codetickets")) return "Codetickets";
    if (h.includes("ra.co")) return "RA";
    return h.split(".")[0];
  } catch { return null; }
}

/** `true` si el seguimiento está vencido o es para hoy. */
export function leToca(f: FichaCrm, hoy: string): boolean {
  return Boolean(f.seg.proximo_seguimiento && f.seg.proximo_seguimiento <= hoy);
}

/**
 * Lee TODAS las filas de una consulta, de mil en mil.
 *
 * PostgREST corta cada respuesta a 1.000 filas sin avisar. Con unos 1.600
 * tardeos, contar "cuántos tardeos lleva cada local" sobre una sola respuesta
 * daba cifras de menos (y la ticketera de los más antiguos ni aparecía). La
 * consulta debe venir ordenada por algo estable para que los lotes no se pisen.
 */
async function todas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>,
): Promise<{ data: T[]; error: { message: string; code?: string } | null }> {
  const LOTE = 1000;
  const filas: T[] = [];
  for (let desde = 0; ; desde += LOTE) {
    const { data, error } = await consulta(desde, desde + LOTE - 1);
    if (error) return { data: filas, error };
    filas.push(...(data ?? []));
    if (!data || data.length < LOTE) return { data: filas, error: null };
  }
}

/**
 * Todo lo necesario para la pantalla, en tres lecturas (cada una por lotes).
 *
 * La de tardeos trae solo `local_id` y `fourvenues_url`, y sirve para dos
 * cosas a la vez —contar cuántos tardeos lleva cada uno y saber con qué
 * ticketera vende ya—. Un local que ya cobra por internet es otra
 * conversación que uno que no.
 */
export async function cargarCrm(): Promise<{ fichas: FichaCrm[]; error: string | null }> {
  type FilaLocal = {
    id: string; nombre: string; zona: string | null; redes: unknown; email: string | null; telefono: string | null;
    owner_id: string | null; plan: string | null; plan_estado: string | null;
  };
  const { data: locales, error } = await todas<FilaLocal>((d, h) => supabase
    .from("locales")
    .select("id,nombre,zona,redes,email,telefono,owner_id,plan,plan_estado")
    .order("nombre").order("id").range(d, h) as unknown as PromiseLike<{ data: FilaLocal[] | null; error: { message: string } | null }>);
  if (error) return { fichas: [], error: error.message };

  type FilaSeg = Seguimiento & { local_id: string; actualizado_en: string | null; actualizado_por: string | null };
  type FilaTardeo = { local_id: string | null; fourvenues_url: string | null };
  const [seg, tardeos] = await Promise.all([
    todas<FilaSeg>((d, h) => supabase.from("seguimiento_comercial").select("*").order("local_id").range(d, h) as unknown as
      PromiseLike<{ data: FilaSeg[] | null; error: { message: string; code?: string } | null }>),
    todas<FilaTardeo>((d, h) => supabase.from("tardeos").select("local_id,fourvenues_url")
      .order("fecha", { ascending: false }).order("id").range(d, h) as unknown as
      PromiseLike<{ data: FilaTardeo[] | null; error: { message: string } | null }>),
  ]);

  // Si falta el lote 35, la pantalla sigue valiendo para ver los contactos: lo
  // único que no se puede es apuntar nada. Mejor eso que una pantalla en blanco.
  const faltaTabla = seg.error?.code === "42P01" || seg.error?.code === "PGRST205";
  // Solo los campos del seguimiento: la fila trae también local_id y las
  // columnas de auditoría, que no deben volver a la base al guardar.
  const porLocal = new Map(seg.data.map((s) => [s.local_id, {
    seg: {
      estado: s.estado, canal: s.canal, notas: s.notas,
      proximo_seguimiento: s.proximo_seguimiento, ultimo_contacto: s.ultimo_contacto,
    } as Seguimiento,
    meta: { actualizado_en: s.actualizado_en ?? null, actualizado_por: s.actualizado_por ?? null },
  }]));

  const cuenta = new Map<string, number>();
  const entradas = new Map<string, string>();
  for (const t of tardeos.data) {
    if (!t.local_id) continue;
    cuenta.set(t.local_id, (cuenta.get(t.local_id) ?? 0) + 1);
    if (t.fourvenues_url && !entradas.has(t.local_id)) entradas.set(t.local_id, t.fourvenues_url);
  }

  const fichas: FichaCrm[] = locales.map((l) => {
    const redes = (l.redes ?? {}) as Record<string, string>;
    const url = entradas.get(l.id) ?? null;
    const s = porLocal.get(l.id);
    return {
      id: l.id,
      nombre: l.nombre,
      zona: l.zona,
      seg: s?.seg ?? SEG_VACIO,
      meta: s?.meta ?? { actualizado_en: null, actualizado_por: null },
      reclamado: Boolean(l.owner_id),
      plan: (l.plan ?? "basic") as Plan,
      planEstado: l.plan_estado ?? "sin_suscripcion",
      instagram: enlaceInstagram(redes.instagram),
      web: enlaceWeb(redes.web),
      facebook: enlaceWeb(redes.facebook),
      email: l.email?.trim() || null,
      telefono: l.telefono?.trim() || null,
      entradas: url,
      ticketera: nombreTicketera(url),
      tardeos: cuenta.get(l.id) ?? 0,
    };
  });

  const avisos = [
    faltaTabla ? "Falta pegar el lote 35 (supabase/35_crm_comercial.sql)." : null,
    !faltaTabla && seg.error ? "No se pudo leer el seguimiento: " + seg.error.message : null,
    tardeos.error ? "No se pudieron contar los tardeos: " + tardeos.error.message : null,
  ].filter(Boolean);
  return { fichas, error: avisos.length ? avisos.join(" ") : null };
}

/**
 * Guarda un cambio del seguimiento.
 *
 * NUNCA se manda `ultimo_contacto`, y eso no es limpieza: es un fallo que ya
 * pasó. Mandándolo, cada vez que se tocaban las notas o la fecha de volver, la
 * de último contacto se movía también, y "último contacto" pasaba a significar
 * "última vez que toqué esta ficha", que no sirve para nada.
 *
 * El motivo es sutil y no se ve leyendo el código. Un upsert de PostgREST es
 * `insert ... on conflict do update set <las columnas que mandaste>`. El
 * disparador `before insert` corre ANTES de saber que hay conflicto, sella
 * `ultimo_contacto` con la hora de ahora, y esa fila sellada es la que el
 * `do update` copia encima de la buena. La columna la calcula la base a partir
 * del cambio de estado; el navegador no tiene nada que decir sobre ella.
 *
 * Se comprueba además que vuelva la fila y no solo que no haya error: con RLS,
 * un upsert que no alcanza nada devuelve 204 sin haber escrito, y darlo por
 * bueno es cómo se acaba creyendo que quedó apuntado algo que no está.
 */
export async function guardarSeguimiento(
  localId: string,
  cambios: Partial<Seguimiento>,
): Promise<string | null> {
  // Solo lo que se edita a mano; `ultimo_contacto` lo pone la base (ver arriba).
  const guardables: Record<string, unknown> = {};
  for (const k of ["estado", "canal", "notas", "proximo_seguimiento"] as const) {
    if (k in cambios) guardables[k] = cambios[k];
  }
  // Quién lo tocó, para el histórico y la exportación. La base no lo rellena sola.
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id) guardables.actualizado_por = session.user.id;
  const { data, error } = await supabase
    .from("seguimiento_comercial")
    .upsert({ local_id: localId, ...guardables }, { onConflict: "local_id" })
    .select("local_id");
  if (error) {
    return error.code === "42P01" || error.code === "PGRST205"
      ? "Falta pegar el lote 35 (supabase/35_crm_comercial.sql)."
      : error.message;
  }
  return data?.length ? null : "No se guardó: solo los administradores pueden.";
}

/* ------------------------------------------------------------------------
 * Exportar a CSV
 *
 * El cliente quiere revisar el CRM junto a HubSpot antes de decidir nada, así
 * que la exportación lleva TODO: ids, contactos, estado comercial, notas y
 * fechas, y quién lo tocó por última vez.
 * ---------------------------------------------------------------------- */

/**
 * Una celda CSV segura. Entre comillas siempre, y si empieza por = + - @
 * (o tabulador/retorno) se le antepone un apóstrofo: Excel y Sheets
 * ejecutarían esa celda como fórmula al abrir el fichero.
 */
export function celdaCsv(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const ETIQUETA_ESTADO: Record<string, string> = Object.fromEntries(ESTADOS.map((e) => [e.k, e.label]));

/** Todas las fichas a CSV (con BOM para que Excel lea bien las tildes). */
export function crmACsv(fichas: FichaCrm[], autores: Map<string, string>): string {
  const cab = [
    "id_local", "nombre", "zona", "estado_comercial", "canal", "notas",
    "proximo_seguimiento", "ultimo_contacto", "actualizado_en", "actualizado_por",
    "reclamado", "plan", "plan_estado", "email", "telefono", "instagram", "web", "facebook",
    "ticketera", "enlace_entradas", "tardeos",
  ];
  const filas = fichas.map((f) => [
    f.id, f.nombre, f.zona, ETIQUETA_ESTADO[f.seg.estado] ?? f.seg.estado, f.seg.canal, f.seg.notas,
    f.seg.proximo_seguimiento, f.seg.ultimo_contacto, f.meta.actualizado_en,
    f.meta.actualizado_por ? autores.get(f.meta.actualizado_por) ?? f.meta.actualizado_por : null,
    f.reclamado ? "sí" : "no", f.plan, f.planEstado, f.email, f.telefono, f.instagram, f.web, f.facebook,
    f.ticketera, f.entradas, f.tardeos,
  ]);
  return "\uFEFF" + [cab, ...filas].map((r) => r.map(celdaCsv).join(",")).join("\r\n");
}

/** Emails de quienes tocaron el seguimiento (pocos: solo los admins). */
export async function leerAutores(fichas: FichaCrm[]): Promise<Map<string, string>> {
  const ids = [...new Set(fichas.map((f) => f.meta.actualizado_por).filter(Boolean))] as string[];
  const m = new Map<string, string>();
  if (!ids.length) return m;
  const { data } = await supabase.from("profiles").select("id,email").in("id", ids);
  (data ?? []).forEach((p: { id: string; email: string | null }) => m.set(p.id, p.email ?? p.id));
  return m;
}
