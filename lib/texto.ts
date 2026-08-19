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
