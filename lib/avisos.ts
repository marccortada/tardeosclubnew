/**
 * Lógica PURA de los avisos programados (dossier 2.0 pág. 10).
 *
 * Sin Supabase ni fechas del sistema: todo recibe "ahora" como parámetro para
 * poder probarlo con fechas simuladas (scratchpad/test-avisos.ts). El cron
 * (`app/api/avisos`) lee la base, llama a esto y envía.
 *
 * La regla de inicio/fin es la MISMA que `public.tardeo_inicio/tardeo_fin`
 * (lote 67): sin hora de inicio, 17:00; sin hora de fin, inicio + 5 h; si la
 * hora de fin es <= la de inicio, acaba al día siguiente. Todo en hora de España.
 */

export const VUELTA_SEGURA =
  "Esperamos que hayas disfrutado del tardeo. Cuídate en el camino de vuelta y llega bien a casa. " +
  "Si has bebido o estás cansado, elige un taxi o transporte público. ¡Nos vemos en el próximo plan!";

const MIN = 60_000;
const HORA = 60 * MIN;

/** Instante UTC de una fecha y hora "de pared" en Europe/Madrid. */
export function instanteMadrid(fecha: string, hora: string): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = (hora || "00:00").split(":").map(Number);
  const pared = Date.UTC(a, m - 1, d, hh, mm || 0);
  // Desfase de Madrid en ese instante (1 h en invierno, 2 h en verano). Se
  // calcula dos veces por si el primer intento cae al otro lado del cambio.
  let t = pared - desfase(new Date(pared));
  t = pared - desfase(new Date(t));
  return new Date(t);
}

function desfase(d: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute")) - Math.floor(d.getTime() / MIN) * MIN;
}

export type TardeoHorario = { fecha: string; hora_inicio: string | null; hora_fin: string | null };

export function instantesTardeo(t: TardeoHorario): { inicio: Date; fin: Date } {
  const hi = (t.hora_inicio || "17:00").slice(0, 5);
  const inicio = instanteMadrid(t.fecha, hi);
  if (!t.hora_fin) return { inicio, fin: new Date(inicio.getTime() + 5 * HORA) };
  const hf = t.hora_fin.slice(0, 5);
  let fin = instanteMadrid(t.fecha, hf);
  if (hf <= hi) {
    const [a, m, d] = t.fecha.split("-").map(Number);
    const sig = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
    fin = instanteMadrid(sig, hf);
  }
  return { inicio, fin };
}

export type Fase = "1h" | "fin";

/**
 * Qué aviso toca ahora para un tardeo publicado, o null.
 *  - "1h": desde 60 min antes del inicio hasta el inicio (si el cron se
 *    retrasa, sale igual mientras no haya empezado).
 *  - "fin": desde la hora de fin hasta 12 h después (más tarde ya no tiene
 *    sentido preguntar "¿qué tal ha ido?" con un push).
 * Cron cada 10 min: cada fase cae en al menos una ejecución. La clave del
 * aviso (con la versión de horario) evita repetirlo.
 */
export function faseDebida(t: TardeoHorario, ahora: Date): Fase | null {
  const { inicio, fin } = instantesTardeo(t);
  const n = ahora.getTime();
  if (n >= inicio.getTime() - HORA && n < inicio.getTime()) return "1h";
  if (n >= fin.getTime() && n < fin.getTime() + 12 * HORA) return "fin";
  return null;
}

/** ¿Está abierta la encuesta (fin ≤ ahora ≤ fin + 72 h)? Igual que en la base. */
export function encuestaAbierta(t: TardeoHorario, ahora: Date): boolean {
  const { fin } = instantesTardeo(t);
  return ahora >= fin && ahora.getTime() <= fin.getTime() + 72 * HORA;
}

/** Minutos hasta el inicio, redondeados (para "empieza en 40 min"). */
export function minutosHastaInicio(t: TardeoHorario, ahora: Date): number {
  return Math.max(0, Math.round((instantesTardeo(t).inicio.getTime() - ahora.getTime()) / MIN));
}

export type SetPropuesta = { id: string; titulo: string; dj_id: string | null; dj_nombre?: string | null; url?: string | null };

/**
 * Propuesta musical del aviso de 1 h antes:
 *   1) un set favorito del usuario (mejor si es de un DJ del cartel),
 *   2) si no, un set de un DJ del cartel,
 *   3) si no, nada. Nunca se reproduce solo: el aviso solo enlaza.
 */
export function elegirPropuesta(favoritos: SetPropuesta[], delCartel: SetPropuesta[], djsCartel: string[]): SetPropuesta | null {
  if (favoritos.length) return favoritos.find((s) => s.dj_id && djsCartel.includes(s.dj_id)) ?? favoritos[0];
  return delCartel[0] ?? null;
}

export type TextoAviso = { tipo: string; titulo: string; cuerpo: string; url: string; clave: string };

export function textoUnaHora(t: { id: string; titulo: string; horario_version?: number | null }, minutos: number, propuesta: SetPropuesta | null): TextoAviso {
  const cuando = minutos >= 50 ? "1 h" : `${minutos} min`;
  const musica = propuesta
    ? ` Para ir calentando: «${propuesta.titulo}»${propuesta.dj_nombre ? ` de ${propuesta.dj_nombre}` : ""}.`
    : "";
  return {
    tipo: "recordatorio",
    titulo: `Tu plan empieza en ${cuando}`,
    cuerpo: `${t.titulo}.${musica} Ten a mano tu entrada o tu nombre en lista.`,
    // Con propuesta, el toque lleva al DJ (allí se pulsa Play); sin ella, a la ficha.
    url: propuesta?.dj_id ? `/djs/${propuesta.dj_id}?set=${propuesta.id}` : `/tardeos/${t.id}`,
    clave: `1h:${t.id}:${t.horario_version ?? 0}`,
  };
}

/** Fin del tardeo: encuesta + vuelta segura en UN solo aviso (dossier: agrupar). */
export function textoFin(t: { id: string; titulo: string; horario_version?: number | null }): TextoAviso {
  return {
    tipo: "fin_evento",
    titulo: "¿Qué tal ha ido?",
    cuerpo: `Cuéntanos qué tal «${t.titulo}» (tienes 72 h). ${VUELTA_SEGURA}`,
    url: `/tardeos/${t.id}/encuesta`,
    clave: `fin:${t.id}:${t.horario_version ?? 0}`,
  };
}

const fmtDia = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function textoCambio(t: { id: string; titulo: string; fecha: string; hora_inicio: string | null; horario_version?: number | null }): TextoAviso {
  const h = (t.hora_inicio ?? "").slice(0, 5);
  return {
    tipo: "cambio",
    titulo: `Cambio de horario: ${t.titulo}`,
    cuerpo: `Ahora es el ${fmtDia(t.fecha)}${h ? ` a las ${h}` : ""}. Revisa si te sigue encajando.`,
    url: `/tardeos/${t.id}`,
    clave: `cambio:${t.id}:${t.horario_version ?? 0}`,
  };
}

export function textoCancelacion(t: { id: string; titulo: string; fecha: string; cancelado_en?: string | null }): TextoAviso {
  return {
    tipo: "cancelacion",
    titulo: `Cancelado: ${t.titulo}`,
    cuerpo: `El tardeo del ${fmtDia(t.fecha)} se ha cancelado. Si tenías plaza, queda anulada; no tienes que hacer nada.`,
    url: `/eventos`,
    // Con la hora de la cancelación en la clave: si se reabre y se vuelve a
    // cancelar, es un aviso NUEVO. Con `cancel:<id>` a secas, el segundo se
    // descartaba por duplicado y nadie se enteraba.
    clave: t.cancelado_en ? `cancel:${t.id}:${Date.parse(t.cancelado_en)}` : `cancel:${t.id}`,
  };
}

/** Esperas antes de avisar de cambios y cancelaciones (ver cron). */
export const ESPERA_CAMBIO_MS = 10 * MIN;
export const ESPERA_CANCELACION_MS = 30 * MIN;
