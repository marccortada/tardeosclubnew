import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

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
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
