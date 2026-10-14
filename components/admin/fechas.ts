/**
 * Instante (ISO UTC) del último segundo de un día en hora de Madrid.
 *
 * `${fecha}T23:59:59Z` era 23:59 en UTC, es decir la 1:59 (verano) o las 0:59
 * (invierno) del día siguiente en Madrid: el destacado duraba una o dos horas
 * de más. Aquí se calcula el desfase real de Madrid para ese día, con su
 * cambio de hora incluido.
 */
export function finDelDiaMadrid(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const pared = Date.UTC(y, m - 1, d, 23, 59, 59);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const desfase = (utc: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
    const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return comoUtc - utc;
  };
  // Dos pasadas: la primera estima, la segunda corrige si cruzamos un cambio de hora.
  let utc = pared - desfase(pared);
  utc = pared - desfase(utc);
  return new Date(utc).toISOString();
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Trocea "YYYY-MM-DD" sin pasar por Date local (evita corrimientos de zona). */
export function partesFecha(fecha: string) {
  const [y, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { dia: d, mes: MESES[m - 1] ?? "", anio: y, semana: DIAS[dia] ?? "" };
}
