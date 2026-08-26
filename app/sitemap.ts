import type { MetadataRoute } from "next";
import { getTardeosPublicados, getLocalesPublicos, getDjsPublicos } from "@/lib/tardeos";
import { SITE_URL } from "@/lib/seo";

// Se rehace cada hora: los tardeos entran y salen del catálogo solos según la
// fecha, y la app antigua publica con uno o dos días de antelación.
// Igual que las listas: se genera al pedirlo. Congelado anunciaba a Google
// decenas de tardeos ya terminados, cuyas fichas devuelven 404.
export const dynamic = "force-dynamic";

/**
 * El mapa del sitio.
 *
 * Sin esto Google solo encontraba lo que estuviera enlazado desde la portada,
 * que son diez tardeos y diez DJs. El resto del catálogo —cientos de fichas—
 * existía sin que nadie pudiera llegar a él buscando.
 *
 * Solo van páginas indexables: nada de /admin, /perfil ni el alta de locales.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/tardeos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/mapa`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/colaboradores`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/legal/aviso-legal`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/legal/privacidad`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/legal/cookies`, changeFrequency: "yearly", priority: 0.1 },
  ];

  // Si Supabase falla no tiramos el sitemap entero: más vale entregar las
  // páginas fijas que devolver un error y que Google se quede sin ninguna.
  const [tardeos, locales, djs] = await Promise.all([
    getTardeosPublicados().catch(() => []),
    getLocalesPublicos().catch(() => []),
    getDjsPublicos().catch(() => []),
  ]);

  const deTardeos: MetadataRoute.Sitemap = tardeos.map((t) => ({
    url: `${SITE_URL}/tardeos/${t.id}`,
    // La fecha del tardeo hace de "última modificación": es lo que de verdad
    // marca si la ficha sigue teniendo sentido.
    lastModified: new Date(`${t.fecha}T00:00:00Z`),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const deLocales: MetadataRoute.Sitemap = locales.map((l: any) => ({
    url: `${SITE_URL}/locales/${l.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const deDjs: MetadataRoute.Sitemap = djs.map((d: any) => ({
    url: `${SITE_URL}/djs/${d.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...fijas, ...deTardeos, ...deLocales, ...deDjs];
}
