import type { Tardeo } from "./types";

/**
 * Cómo se pinta un tardeo: su flyer y su fecha.
 *
 * Esto vivía en `lib/mockData.ts` junto a cinco DJs, tres locales y ocho
 * tardeos inventados que ya no usaba nadie —el fichero solo se importaba por
 * estas dos funciones— pero que seguían viajando en el repositorio, con una
 * lista de zonas obsoleta incluida. Contenido ficticio a un import de
 * distancia de una pantalla pública.
 *
 * Aquí no hay datos: solo dos funciones de formato.
 */

/**
 * Fuente del flyer: la de Supabase o, si falta, una genérica.
 *
 * Antes devolvía `/flyers/${t.id}.jpg?v=3`, que estaba mal por partida doble
 * en cuanto el tardeo era de verdad y no uno de los mocks t1…t8:
 *
 *  - ese fichero NO existe: en public/flyers solo hay t1…t8 y placeholder;
 *  - y el `?v=3` hace que Next 16 lance al pintar, porque una imagen local
 *    con cadena de consulta necesita `images.localPatterns` declarado.
 *
 * Lo segundo es lo grave. No rompe solo esa tarjeta: revienta el render de
 * TODA la página, la regeneración se queda a medias y /tardeos se congela en
 * el contenido anterior. Sin error visible: la web sigue respondiendo 200 y
 * simplemente deja de enterarse de los tardeos nuevos.
 *
 * Hoy los 665 tardeos traen flyer, así que no salta. Saltaría el día que
 * alguien publique uno sin él.
 */
export function flyerSrc(t: Tardeo): string {
  return t.flyer ?? "/flyers/placeholder.jpg";
}

export function formatFecha(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const f = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  // Solo la primera letra. Se hacía con la clase `capitalize` de CSS, que sube
  // TODAS las palabras y escribía "Domingo, 23 De Agosto": en castellano los
  // días y los meses van en minúscula.
  return f.charAt(0).toUpperCase() + f.slice(1);
}
