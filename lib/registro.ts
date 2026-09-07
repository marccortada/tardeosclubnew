/**
 * Un solo sitio por el que pasan los fallos.
 *
 * Antes había dieciocho `console.error` repartidos, cada uno con su formato.
 * Se leían bien de uno en uno y no servían para nada de lo que pide Q-06: no
 * se podía filtrar el registro del servidor por gravedad, no había forma de
 * relacionar dos líneas de la misma petición, y en el navegador se perdían en
 * cuanto alguien recargaba.
 *
 * Esto no sustituye a un servicio de registro de verdad —eso es una decisión
 * con coste, y no nos toca a nosotros—. Lo que hace es dejarlo todo con la
 * misma forma para que el día que se contrate uno, se enchufe en una línea.
 */

export type Gravedad = "aviso" | "fallo";

/**
 * Marca de la ejecución. En el servidor identifica el proceso; en el navegador,
 * la pestaña. Sirve para lo que hoy no se puede hacer: ver que cinco líneas
 * sueltas del registro son en realidad el mismo problema.
 */
const TRAZA = Math.random().toString(36).slice(2, 8);

/** Los últimos fallos de esta ejecución, para poder enseñarlos en el panel. */
const ULTIMOS: { cuando: string; gravedad: Gravedad; area: string; mensaje: string }[] = [];
const TOPE = 50;

function texto(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  const o = e as { message?: string; code?: string };
  return [o.code, o.message].filter(Boolean).join(" · ") || String(e);
}

/**
 * Apunta un fallo. NUNCA lanza: registrar no puede romper lo que estaba
 * intentando hacer quien llama.
 *
 * @param area  De qué parte viene: "tardeos", "djs", "planes"…
 * @param que   Qué se estaba haciendo, en una frase de persona.
 * @param e     El error, tal cual llegue.
 */
export function registrar(area: string, que: string, e?: unknown, gravedad: Gravedad = "fallo"): void {
  try {
    const detalle = texto(e);
    const linea = `[${gravedad}][${area}][${TRAZA}] ${que}${detalle ? ` — ${detalle}` : ""}`;

    ULTIMOS.push({ cuando: new Date().toISOString(), gravedad, area, mensaje: `${que}${detalle ? ` — ${detalle}` : ""}` });
    if (ULTIMOS.length > TOPE) ULTIMOS.shift();

    // `error` y no `log` para lo grave: pm2 los separa en ficheros distintos y
    // así `pm2 logs tardeosclub --err` enseña solo lo que hay que mirar.
    if (gravedad === "fallo") console.error(linea);
    else console.warn(linea);
  } catch {
    /* si falla el propio registro, no se hace nada: no puede tumbar la página */
  }
}

/** Lo mismo, para cosas que no son un fallo pero conviene ver. */
export const avisar = (area: string, que: string, e?: unknown) => registrar(area, que, e, "aviso");

/** Los últimos fallos de esta ejecución. Se usa en el panel de salud. */
export const ultimosFallos = () => [...ULTIMOS].reverse();

/** La marca de esta ejecución, para poder citarla al pedir ayuda. */
export const traza = () => TRAZA;
