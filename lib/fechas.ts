/**
 * Fechas del listado, siempre en el huso de España.
 *
 * El navegador de quien mira puede estar en cualquier huso —o con el reloj
 * cambiado—, y «hoy» tiene que ser el mismo día para todos: el que ve alguien
 * en Mataró. Si no, a las 00:30 en Canarias «Hoy» enseñaría los de ayer.
 */

/** Hoy en España, como "2026-09-07". */
export const hoyEnEspana = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

/**
 * Qué DÍA es un instante, en España. "2026-09-07".
 *
 * Hace falta porque un `timestamptz` de la base puede caer a cualquier hora, y
 * comparar instantes en bruto se lleva por delante el último día: una
 * suscripción que vence hoy a las 00:30 valdría media hora en vez de un día.
 * Y `toISOString()` a secas no sirve: las 00:30 de Madrid son las 22:30 UTC
 * del día ANTERIOR, así que en verano restaría un día a todo lo nocturno.
 */
export function diaEnEspana(cuando: string | Date): string | null {
  const d = typeof cuando === "string" ? new Date(cuando) : cuando;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
}

/** Días enteros entre dos días ISO. Negativo si el segundo ya pasó. */
export function diasEntre(desde: string, hasta: string): number {
  const n = (iso: string) => { const [a, m, d] = iso.split("-").map(Number); return Date.UTC(a, m - 1, d); };
  return Math.round((n(hasta) - n(desde)) / 86400000);
}

/** El día de la semana de una fecha ISO. 0 domingo … 6 sábado. */
export function diaDeLaSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * La próxima vez que caiga ese día de la semana, contando HOY.
 *
 * Si hoy es viernes, «Viernes» es hoy y no dentro de siete días. Suena obvio y
 * es justo lo que se hace mal: un `+7` a secas manda al viernes que viene a
 * quien está mirando el listado un viernes por la tarde, que es cuando más
 * gente lo mira.
 */
export function proximoDia(dow: number, desde: string = hoyEnEspana()): string {
  const [a, m, d] = desde.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  const salto = (dow - base.getUTCDay() + 7) % 7;   // 0 = hoy
  base.setUTCDate(base.getUTCDate() + salto);
  return base.toISOString().slice(0, 10);
}

/** "vie 12" — para las pastillas del filtro, que van muy justas de sitio. */
export function diaCorto(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d))
    .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", timeZone: "UTC" })
    .replace(".", "");
}
