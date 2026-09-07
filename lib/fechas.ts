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
