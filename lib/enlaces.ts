/**
 * Enlaces que salen a fuera, cuando el destino lo ha escrito una persona.
 *
 * Vale para las redes de un local, la playlist de un perfil y los contenidos
 * de un DJ: en los tres casos el destino viene de un campo de texto que rellena
 * el propio interesado, y de ahí a la ficha pública no hay ninguna comprobación.
 */

/** Quita espacios, envolturas y la barra final. Lo primero de todo. */
const limpio = (v: unknown): string =>
  typeof v === "string" ? v.trim().replace(/\/+$/, "") : "";

/**
 * Una URL que se pueda abrir, o `null`.
 *
 * Se le pone `https://` a lo que llega sin esquema —«miweb.com» es lo que
 * escribe la gente— y se rechaza cualquier otro esquema. Sin esto, un
 * `javascript:` guardado en la base se convertiría en un enlace ejecutable en
 * la ficha pública, que es de las pocas formas que tiene un local de atacar a
 * quien la visita.
 */
export function urlSegura(v: unknown): string | null {
  const s = limpio(v);
  if (!s) return null;
  const conEsquema = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(conEsquema);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
