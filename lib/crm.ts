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
 * Todo lo necesario para la pantalla, en tres consultas.
 *
 * La de tardeos trae solo `local_id` y `fourvenues_url` de los que tienen
 * enlace: son 60 filas de 780, y sirve para dos cosas a la vez —contar cuántos
 * tardeos lleva cada uno y saber con qué ticketera vende ya—. Un local que ya
 * cobra por internet es otra conversación que uno que no.
 */
export async function cargarCrm(): Promise<{ fichas: FichaCrm[]; error: string | null }> {
  const { data: locales, error } = await supabase
    .from("locales")
    .select("id,nombre,zona,redes,email,telefono,owner_id,plan,plan_estado")
    .order("nombre");
  if (error) return { fichas: [], error: error.message };

  const [seg, tardeos] = await Promise.all([
    supabase.from("seguimiento_comercial").select("*"),
    supabase.from("tardeos").select("local_id,fourvenues_url,fecha").order("fecha", { ascending: false }),
  ]);

  // Si falta el lote 35, la pantalla sigue valiendo para ver los contactos: lo
  // único que no se puede es apuntar nada. Mejor eso que una pantalla en blanco.
  const faltaTabla = seg.error?.code === "42P01" || seg.error?.code === "PGRST205";
  const porLocal = new Map((seg.data ?? []).map((s) => [s.local_id as string, s as unknown as Seguimiento]));

  const cuenta = new Map<string, number>();
  const entradas = new Map<string, string>();
  for (const t of tardeos.data ?? []) {
    if (!t.local_id) continue;
    cuenta.set(t.local_id, (cuenta.get(t.local_id) ?? 0) + 1);
    if (t.fourvenues_url && !entradas.has(t.local_id)) entradas.set(t.local_id, t.fourvenues_url);
  }

  const fichas: FichaCrm[] = (locales ?? []).map((l) => {
    const redes = (l.redes ?? {}) as Record<string, string>;
    const url = entradas.get(l.id) ?? null;
    return {
      id: l.id,
      nombre: l.nombre,
      zona: l.zona,
      seg: porLocal.get(l.id) ?? SEG_VACIO,
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

  return { fichas, error: faltaTabla ? "Falta pegar el lote 35 (supabase/35_crm_comercial.sql)." : null };
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
  const guardables = { ...cambios };
  delete guardables.ultimo_contacto;
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
