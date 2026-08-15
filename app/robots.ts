import type { MetadataRoute } from "next";
import { SITE_URL, INDEXABLE } from "@/lib/seo";

/**
 * Solo se bloquea /api/: no son páginas y no hay nada que indexar en ellas.
 *
 * Las pantallas privadas (/admin, /perfil, /local, /dj…) NO se bloquean aquí a
 * propósito. Se marcan con noindex en su propio HTML, y para que Google lea
 * esa etiqueta tiene que poder entrar: una ruta prohibida en robots.txt que
 * alguien enlaza puede acabar listada igualmente, con el buscador adivinando
 * el título porque nunca ha visto la página.
 *
 * Ojo si algún día se añade algo aquí: robots.txt casa por prefijo, así que un
 * "/local" bloquearía también las 55 fichas de /locales/…
 */
export default function robots(): MetadataRoute.Robots {
  // En el dominio provisional no se anuncia el sitemap, pero SÍ se deja pasar
  // al robot: el "no me indexes" viaja en cada página y en la cabecera
  // X-Robots-Tag, y para leerlo tiene que poder entrar. Con "Disallow: /" se
  // quedaría fuera sin llegar a verlo, y las URLs que alguien enlazara podrían
  // acabar listadas igual — que es justo lo que queremos evitar.
  if (!INDEXABLE) {
    return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
