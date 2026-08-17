/**
 * El "ADN" de un tardeo, más allá de la música: a quién va dirigido y cómo se
 * va vestido.
 *
 * Igual que lib/musica.ts, esto es vocabulario compartido. La idea del
 * documento es que tardeo, local, promotor, DJ y tardícola se describan con los
 * mismos criterios para poder cruzarlos y recomendar; si cada formulario
 * tuviera su lista, el cruce no sería posible.
 *
 * Los dos admiten texto libre ("Otro…"): las listas son sugerencias, no una
 * camisa de fuerza. Por eso en la base son `text[]` y `text` y no enums.
 */

/**
 * A qué va la gente. Es el cuarto filtro principal del documento, junto a
 * cuándo, dónde y qué música.
 *
 * Varios a la vez: un afterwork es también social, y un temático puede ser
 * fiestero. Forzar uno solo obligaría al local a elegir mal.
 */
export const AMBIENTES = [
  "Relajado / Chill",
  "Social",
  "Conocer gente",
  "Afterwork",
  "Networking",
  "Romántico",
  "Familiar",
  "Temático",
  "Alternativo",
  "Animado",
  "Fiestero",
  "Festivalero",
];

/**
 * Qué clase de evento es. Uno solo: un brunch no es a la vez un nocheo.
 *
 * Se solapa a medias con la franja horaria, pero no se deduce de la hora a
 * propósito: un Coffee Rave y un Vermuteo pueden empezar a la misma y no son lo
 * mismo.
 */
export const TIPOS_EVENTO = [
  "Tardeo",
  "Mañaneo",
  "Coffee Rave",
  "Vermuteo",
  "Brunch",
  "After Work",
  "Nocheo",
  "Festival",
];

/** Franjas de edad. Un tardeo puede apuntar a varias. */
export const PUBLICOS = ["+21", "25-35", "35-55", "+55"];

/** Cómo se va vestido. Una sola por tardeo. */
export const DRESS_CODES = [
  "Casual",
  "Casual Elegante",
  "Urbano",
  "Dressed to impress",
  "Chic",
  "Playero",
  "Libre",
];

/**
 * Compara sin distinguir mayúsculas ni acentos.
 *
 * Hace falta porque el "Otro…" deja escribir a mano: si un local pone "casual
 * elegante" en minúsculas, tiene que seguir saliendo al filtrar por "Casual
 * Elegante". Mismo criterio que con los estilos musicales, donde la app
 * antigua dejó 58 variantes de 30 estilos.
 */
export function mismoValor(a?: string | null, b?: string | null): boolean {
  const k = (s?: string | null) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9+]+/g, " ")
      .trim();
  return Boolean(a) && Boolean(b) && k(a) === k(b);
}

/** ¿Está ese valor en la lista? Vale para público y para ambiente, que los dos
 *  son arrays con posible texto libre dentro. */
export function contiene(lista: string[] | null | undefined, valor: string): boolean {
  return (lista ?? []).some((v) => mismoValor(v, valor));
}
