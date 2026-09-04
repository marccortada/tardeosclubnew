/**
 * Las fechas de un tardeo que se repite.
 *
 * QUÉ SE GUARDA: nada. Un tardeo semanal son cinco tardeos sueltos, cada uno
 * con su fila, su flyer y sus entradas. No hay "serie" en la base.
 *
 * Es una decisión, no una simplificación por vagancia. Toda la app está montada
 * sobre "una fila = una tarde": el mapa, los favoritos, las métricas, las
 * cuotas del plan, el ADN. Una serie que se edita junta obligaría a que cada
 * una de esas cosas supiera qué hacer cuando cambia el original —¿se mueven los
 * favoritos?, ¿cuántos eventos consume del plan?— y a decidir qué pasa al
 * borrar uno del medio. A cambio de eso, ahorra tener que editar cinco fichas
 * el día que cambie el horario. Con cinco fichas al mes, no compensa.
 *
 * Lo que sí hace falta es que el que las crea VEA las fechas antes de darle,
 * porque después son cinco tardeos independientes y arreglarlos es a mano.
 */

export const FRECUENCIAS = [
  { k: "una", label: "No se repite", pie: "Un solo día" },
  { k: "semana", label: "Cada semana", pie: "El mismo día, cada 7 días" },
  { k: "quincena", label: "Cada 15 días", pie: "Un finde sí y otro no" },
  { k: "mes", label: "Cada mes", pie: "El mismo día de cada mes" },
] as const;

export type Frecuencia = (typeof FRECUENCIAS)[number]["k"];
export type Periodicidad = { cada: Frecuencia; hasta: string };

export const SIN_REPETIR: Periodicidad = { cada: "una", hasta: "" };

/**
 * El tope. No es por rendimiento —insertar 200 filas da igual— sino porque un
 * error de dedo en la fecha de fin ("2027" en vez de "2026") crearía un año de
 * tardeos que hay que borrar uno a uno. Cuando se llega al tope se dice; no se
 * recorta a la callada.
 */
export const MAXIMO = 52;

/** "2026-09-07" -> [2026, 9, 7]. Sin `new Date`, que interpreta zona horaria. */
function partes(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Cuántos días tiene un mes, contando bisiestos. */
function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Suma días a una fecha ISO.
 *
 * En UTC a propósito. Con `new Date("2026-09-07")` el navegador entiende
 * medianoche UTC, y si luego se lee con getDate() en Madrid sale el día 7 en
 * verano pero el 6 en cuanto alguien esté al oeste de Greenwich. Un desfase de
 * un día en un tardeo semanal lo convierte en un tardeo de los sábados que sale
 * los viernes.
 */
function sumarDias(fecha: string, dias: number): string {
  const p = partes(fecha);
  if (!p) return fecha;
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Suma meses conservando el día ORIGINAL, no el del mes anterior.
 *
 * "El 31 de cada mes" desde el 31 de enero da 28 de febrero y luego 31 de
 * marzo, no 28 de marzo. Arrastrar el día recortado es el fallo clásico: una
 * serie que empieza el 31 acaba corriéndose al 28 para siempre.
 */
function sumarMeses(fecha: string, meses: number): string {
  const p = partes(fecha);
  if (!p) return fecha;
  const [anio, mes, dia] = p;
  const total = (anio * 12 + (mes - 1)) + meses;
  const a2 = Math.floor(total / 12);
  const m2 = (total % 12) + 1;
  return iso(a2, m2, Math.min(dia, diasDelMes(a2, m2)));
}

/**
 * Las fechas de la serie, la primera incluida.
 *
 * Devuelve `[inicio]` si no se repite, si falta el "hasta" o si el "hasta" es
 * anterior: en todos esos casos lo correcto es un tardeo, no ninguno ni un
 * error. Quien llama no tiene que comprobar nada.
 */
export function fechasDeSerie(inicio: string, p: Periodicidad): string[] {
  if (!partes(inicio)) return [];
  if (p.cada === "una" || !p.hasta || p.hasta < inicio) return [inicio];

  const paso = (f: string, n: number) =>
    p.cada === "mes" ? sumarMeses(inicio, n) : sumarDias(f, p.cada === "semana" ? 7 : 14);

  const fechas = [inicio];
  let actual = inicio;
  for (let n = 1; fechas.length < MAXIMO; n++) {
    actual = paso(actual, n);
    if (actual > p.hasta) break;
    fechas.push(actual);
  }
  return fechas;
}

/**
 * ¿Es una fecha que se pueda usar? "2026-09-07" sí; "07/09/2026" y "" no.
 *
 * Hace falta fuera porque un `<input type="date">` puede quedarse con un valor
 * que no cumple el formato —lo rellenó la IA leyendo un flyer, o el navegador
 * no lo validó— y entonces `fechasDeSerie` devuelve la lista vacía. Sin poder
 * distinguir "todavía no hay fecha" de "la fecha no vale", la pantalla enseña
 * «Se crearán 0 tardeos», que no explica nada.
 */
export const esFecha = (f: string): boolean => partes(f) !== null;

/**
 * La misma fecha, N meses después. Para los atajos de «hasta cuándo».
 *
 * Reutiliza `sumarMeses`, así que hereda su regla: conserva el día original y
 * no lo arrastra recortado. Del 31 de enero, +1 mes es el 28 de febrero, y +2
 * el 31 de marzo.
 */
export const masMeses = (fecha: string, meses: number): string => sumarMeses(fecha, meses);

/** `true` si la serie se ha cortado por el tope y hay que decirlo. */
export function llegaAlTope(inicio: string, p: Periodicidad): boolean {
  return fechasDeSerie(inicio, p).length >= MAXIMO;
}

/** "dom 7 sep" — corto, que se enseñan hasta 52. */
export function fechaCorta(f: string): string {
  const p = partes(f);
  if (!p) return f;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}
