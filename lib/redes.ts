/**
 * Las redes de un local, que vienen de la app vieja y vienen sucias.
 *
 * `locales.redes` es un jsonb que la migración rellenó con lo que había: 46 de
 * los 60 locales activos traen algo, y cada uno con su formato. Hay handles con
 * arroba («@eternalmataro»), URL completas con parámetros de seguimiento
 * («…?igsh=MTNs…&utm_source=qr»), y algún local que se puso su Instagram en el
 * campo de la web. Ninguna pantalla las enseñaba, así que nadie lo había visto.
 *
 * Aquí se normaliza todo a un enlace que funcione, y se quita el rastreo: pasar
 * un `utm_source=qr` de la ficha de un local a quien la mira no aporta nada y
 * se lo lleva puesto a Instagram.
 */

import { urlSegura } from "./enlaces";

/** Quita espacios, envolturas y la barra final. Lo primero de todo. */
const limpio = (v: unknown): string =>
  typeof v === "string" ? v.trim().replace(/\/+$/, "") : "";

/**
 * El nombre de usuario de Instagram, venga como venga.
 *
 * Devuelve `null` si de ahí no sale un usuario: mejor no enseñar el botón que
 * enseñar uno que lleva a una página que no existe.
 */
export function handleInstagram(v: unknown): string | null {
  const s = limpio(v);
  if (!s) return null;
  // De una URL nos quedamos con el primer tramo del camino; de un texto suelto,
  // con él mismo sin la arroba.
  const m = /instagram\.com\/([^/?#]+)/i.exec(s);
  const bruto = m ? m[1] : s.replace(/^@/, "");
  // Instagram admite letras, números, punto y guion bajo, hasta 30.
  return /^[A-Za-z0-9._]{1,30}$/.test(bruto) ? bruto : null;
}

/** El enlace al perfil, ya limpio de parámetros de seguimiento. */
export function urlInstagram(v: unknown): string | null {
  const h = handleInstagram(v);
  return h ? `https://instagram.com/${h}` : null;
}

export { urlSegura };

export type Red = { k: "instagram" | "facebook" | "web" | "reservas"; label: string; url: string };

/**
 * Dos enlaces que llevan al mismo sitio escritos de forma distinta.
 *
 * No basta con comparar las cadenas: el que está en «web» conserva el
 * `www.` y los parámetros de seguimiento, y el de «instagram» ya viene
 * limpio, así que como texto no se parecen en nada aunque abran la misma
 * página. Se comparan por el perfil al que apuntan.
 */
const canonico = (url: string): string => urlInstagram(url) ?? url.toLowerCase();

/**
 * Los enlaces que hay que pintar, en orden y sin repetir.
 *
 * SIN REPETIR de verdad: diez locales tienen algo en «web», y a algunos lo que
 * les pusieron ahí es su propio Instagram. Enseñar dos botones al mismo sitio
 * con nombres distintos hace pensar que uno de los dos lleva a otra parte.
 * Instagram va primero en la lista, así que en un empate gana él, que es el
 * que tiene el nombre correcto.
 */
export function enlacesDe(redes: unknown): Red[] {
  const r = (redes ?? {}) as Record<string, unknown>;
  const salida: Red[] = [];
  const vistos = new Set<string>();

  const meter = (k: Red["k"], label: string, url: string | null) => {
    if (!url) return;
    const clave = canonico(url);
    if (vistos.has(clave)) return;
    vistos.add(clave);
    salida.push({ k, label, url });
  };

  meter("instagram", "Instagram", urlInstagram(r.instagram));
  meter("reservas", "Reservar", urlSegura(r.reservas));
  meter("web", "Web", urlSegura(r.web));
  meter("facebook", "Facebook", urlSegura(r.facebook));
  return salida;
}

/**
 * Lo que se guarda desde el editor: sin las claves vacías.
 *
 * Guardar `{instagram: ""}` no es lo mismo que no guardar la clave — la primera
 * forma deja basura que luego hay que comprobar en cada lectura.
 */
export function redesParaGuardar(campos: Record<string, string>): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) {
    const s = v.trim();
    if (s) salida[k] = s;
  }
  return salida;
}
