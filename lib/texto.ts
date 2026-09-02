/**
 * Buscar texto como lo escribe la gente.
 *
 * Los buscadores comparaban con `toLowerCase()` y nada más, y en una app de la
 * costa catalana eso deja fuera media cartelera: "mataro" no encontraba Mataró,
 * "guixols" no encontraba Sant Feliu de Guíxols, "besos" no encontraba Sant
 * Adrià de Besòs. Nadie pone tildes en una caja de búsqueda, y menos en el
 * móvil.
 *
 * La puntuación también se va, y por lo mismo: "80s" tiene que encontrar
 * "80's", y "r&b" el "R&B". Los espacios SÍ se quedan, para que "asonaba" no
 * encuentre "Así Sonaba".
 *
 * Es a propósito distinto de `mismoValor` (lib/adn.ts), que compara igualdad
 * exacta para casar etiquetas de un vocabulario cerrado. Aquí hace falta
 * subcadena.
 */
export function plegar(s?: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, "");
}

/** ¿Aparece `aguja` dentro de `pajar`, ignorando mayúsculas, tildes y puntuación?
 *  `aguja` tiene que venir ya plegada. */
export function contieneTexto(pajar: string | null | undefined, aguja: string): boolean {
  return plegar(pajar).includes(aguja);
}

/**
 * Quita las marcas de markdown de un texto que se va a pintar tal cual.
 *
 * Las descripciones y biografías se escriben a mano, se pegan de otro sitio o
 * las genera una IA, y llegan con `**negritas**`, `_cursivas_` o `## títulos`
 * que nadie interpreta: en pantalla se ven los asteriscos. Ahora mismo hay una
 * ficha de DJ publicada que dice literalmente "**Afro House**".
 *
 * Se limpia AL PINTAR y no al guardar: lo que ya está guardado no se toca —no
 * es asunto nuestro reescribir lo que alguien escribió— y el día que llegue
 * otro texto con marcas, tampoco se verá.
 *
 * No convierte a negrita de verdad a propósito: eso obliga a meter HTML de
 * terceros en la página, y para un puñado de textos no compensa el riesgo.
 */
export function sinMarcas(texto?: string | null): string {
  if (!texto) return "";
  return texto
    .replace(/^#{1,6}\s+/gm, "")              // ## títulos
    .replace(/\*\*(.+?)\*\*/g, "$1")          // **negrita**
    .replace(/__(.+?)__/g, "$1")              // __negrita__
    .replace(/(^|\s)\*(\S(?:.*?\S)?)\*(?=\s|$)/g, "$1$2")   // *cursiva*
    .replace(/(^|\s)_(\S(?:.*?\S)?)_(?=\s|$)/g, "$1$2")       // _cursiva_
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")     // [texto](enlace)
    .replace(/^\s*[-*+]\s+/gm, "· ")          // - viñetas
    .trim();
}
