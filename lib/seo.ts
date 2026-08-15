import type { Metadata } from "next";
import type { Tardeo } from "./types";

/**
 * Dirección pública del sitio. Todo lo que Google necesita en absoluto
 * (canónicas, sitemap, datos estructurados) sale de aquí.
 *
 * El valor real llega por NEXT_PUBLIC_SITE_URL. Si falta, caemos al dominio
 * bueno y NO a localhost: una canónica apuntando a localhost le dice a Google
 * que la página real está en un sitio al que no puede entrar.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://app.tardeosclub.com"
).replace(/\/$/, "");

export function urlAbsoluta(ruta: string): string {
  return ruta.startsWith("http") ? ruta : `${SITE_URL}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}

/**
 * Si esta copia de la web puede salir en Google.
 *
 * Mientras la app viva en un dominio provisional (ahora crm.gnerai.com, que es
 * el del CRM) no interesa que se indexe: cuando se mude al definitivo tendría
 * dos webs iguales compitiendo entre ellas y habría que montar redirecciones
 * para no perder lo ganado. El sitemap y los datos estructurados quedan
 * hechos, solo dormidos.
 *
 * Se activa poniendo PERMITIR_INDEXACION=true en el servidor del dominio bueno.
 */
export const INDEXABLE = process.env.PERMITIR_INDEXACION === "true";

/**
 * Metadatos de una pantalla privada (cuenta, panel, alta de local).
 *
 * Llevan noindex en vez de bloquearse por robots.txt a propósito: una ruta
 * bloqueada que alguien enlaza puede acabar indexada igual, porque Google ve
 * el enlace pero no puede entrar a leer el "no me indexes". Dejándole pasar,
 * lee la etiqueta y la respeta.
 */
export function metadataPrivada(titulo: string): Metadata {
  return {
    title: `${titulo} · TardeosClub`,
    robots: { index: false, follow: false },
  };
}

/** Metadatos de una pantalla pública, con su canónica. */
export function metadataPublica(
  titulo: string,
  descripcion: string,
  ruta: string
): Metadata {
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: urlAbsoluta(ruta) },
    openGraph: {
      title: titulo,
      description: descripcion,
      url: urlAbsoluta(ruta),
      type: "website",
    },
  };
}

// ---------- Datos estructurados ----------

/**
 * Desfase horario de Madrid en una fecha concreta ("+02:00" en verano,
 * "+01:00" en invierno).
 *
 * Un evento sin zona horaria lo interpreta Google como UTC, y un tardeo de las
 * 18:00 aparecería a las 20:00 en los resultados de búsqueda. Se calcula por
 * fecha y no con una constante porque el cambio de hora cae en marzo y
 * octubre, justo en temporada.
 */
function desfaseMadrid(fechaISO: string): string {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid",
      timeZoneName: "longOffset",
    }).formatToParts(new Date(`${fechaISO}T12:00:00Z`));
    const nombre = partes.find((p) => p.type === "timeZoneName")?.value ?? "";
    const off = nombre.replace("GMT", "");
    return /^[+-]\d{2}:\d{2}$/.test(off) ? off : "+01:00";
  } catch {
    return "+01:00";
  }
}

function instante(fecha: string, hora: string): string {
  return `${fecha}T${(hora || "00:00").slice(0, 5)}:00${desfaseMadrid(fecha)}`;
}

function diaSiguiente(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Un tardeo como `Event` de schema.org.
 *
 * Es lo que permite que Google lo enseñe como evento —con fecha, sitio y
 * precio en el propio resultado— en vez de como un enlace azul más. Para una
 * web cuyo contenido son fiestas con fecha, es la diferencia entre aparecer y
 * no aparecer cuando alguien busca "tardeos en Mataró este sábado".
 */
export function jsonLdEvento(t: Tardeo) {
  const url = urlAbsoluta(`/tardeos/${t.id}`);
  const inicio = t.horaInicio || "18:00";
  const fin = t.horaFin || "";
  // Un tardeo que acaba de madrugada termina al día siguiente.
  const fechaFin = fin && fin < inicio ? diaSiguiente(t.fecha) : t.fecha;

  const datos: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: t.titulo,
    startDate: instante(t.fecha, inicio),
    eventStatus:
      t.estado === "cancelado"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
  };

  if (fin) datos.endDate = instante(fechaFin, fin);
  if (t.estilo) datos.description = `Tardeo de ${t.estilo} en ${t.local.nombre}${t.zona ? ` (${t.zona})` : ""}.`;
  if (t.flyer) datos.image = [t.flyer];

  // Un promotor no tiene sitio fijo, pero el tardeo sí: la dirección va en el
  // evento igualmente porque es donde se celebra.
  const lugar: Record<string, unknown> = { "@type": "Place", name: t.local.nombre };
  if (t.local.direccion) {
    lugar.address = {
      "@type": "PostalAddress",
      streetAddress: t.local.direccion,
      addressLocality: t.zona || t.local.zona || undefined,
      addressCountry: "ES",
    };
  }
  if (t.lat && t.lng) {
    lugar.geo = { "@type": "GeoCoordinates", latitude: t.lat, longitude: t.lng };
  }
  datos.location = lugar;

  if (t.local.nombre) {
    datos.organizer = {
      "@type": "Organization",
      name: t.local.nombre,
      url: urlAbsoluta(`/locales/${t.local.id}`),
    };
  }

  if (t.djs?.length) {
    datos.performer = t.djs
      .filter((d) => d.nombre)
      .map((d) => ({ "@type": "PerformingGroup", name: d.nombre }));
  }

  /**
   * El precio solo se declara cuando se sabe de verdad.
   *
   * Un tardeo de pago sin importe no es gratis: ponerle 0 llenaría el
   * buscador de "Gratis" para fiestas que se cobran en puerta. Cuando no lo
   * sabemos se manda la oferta sin precio, que es lo honesto.
   */
  const oferta: Record<string, unknown> = {
    "@type": "Offer",
    url,
    availability: "https://schema.org/InStock",
  };
  if (t.tipoEntrada === "gratis") {
    oferta.price = 0;
    oferta.priceCurrency = "EUR";
  } else if (t.precio != null) {
    oferta.price = t.precio;
    oferta.priceCurrency = "EUR";
  }
  datos.offers = oferta;

  return datos;
}

/** Un local (o promotor) como negocio, con los tardeos que tiene en cartel. */
export function jsonLdLocal(local: any, tardeos: Tardeo[]) {
  const esPromotor = local.tipo === "promotor";
  const datos: Record<string, unknown> = {
    "@context": "https://schema.org",
    // Un promotor no es un sitio al que ir: es quien organiza.
    "@type": esPromotor ? "Organization" : "NightClub",
    name: local.nombre,
    url: urlAbsoluta(`/locales/${local.id}`),
  };

  if (local.descripcion) datos.description = local.descripcion;
  if (local.logo_url) datos.logo = local.logo_url;
  const fotos = Array.isArray(local.fotos) ? local.fotos : [];
  if (fotos.length) datos.image = fotos;
  if (local.telefono) datos.telephone = local.telefono;

  if (!esPromotor && local.direccion) {
    datos.address = {
      "@type": "PostalAddress",
      streetAddress: local.direccion,
      addressLocality: local.zona || undefined,
      postalCode: local.codigo_postal || undefined,
      addressCountry: "ES",
    };
  }
  if (!esPromotor && local.lat && local.lng) {
    datos.geo = { "@type": "GeoCoordinates", latitude: local.lat, longitude: local.lng };
  }

  if (tardeos.length) datos.event = tardeos.map(jsonLdEvento);
  return datos;
}

/**
 * Un DJ como artista musical.
 *
 * `redes` tiene que llegar ya en URLs absolutas: en la base están guardadas
 * como "@usuario" y `sameAs` con un arroba no le dice nada a Google. La página
 * ya las normaliza para pintar los iconos, así que reusamos esas.
 */
export function jsonLdDj(dj: any, tardeos: Tardeo[], redes: string[] = []) {
  const estilos = Array.isArray(dj.estilos) ? dj.estilos : [];
  const datos: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: dj.nombre_artistico,
    url: urlAbsoluta(`/djs/${dj.id}`),
  };
  if (dj.bio) datos.description = dj.bio;
  if (dj.avatar_url) datos.image = dj.avatar_url;
  if (estilos.length) datos.genre = estilos;
  if (redes.length) datos.sameAs = redes;
  if (tardeos.length) datos.event = tardeos.map(jsonLdEvento);
  return datos;
}

/**
 * La web como tal, para la portada. El `SearchAction` es lo que puede darle a
 * Google la cajita de búsqueda propia dentro del resultado.
 */
export function jsonLdSitio() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#web`,
        url: SITE_URL,
        name: "TardeosClub",
        inLanguage: "es-ES",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/tardeos?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organizacion`,
        name: "TardeosClub",
        url: SITE_URL,
        logo: urlAbsoluta("/branding/icon-512.png"),
        description: "El buscador de tardeos de la costa catalana.",
      },
    ],
  };
}
