/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Las direcciones de la web actual que aquí no existen.
   *
   * `tardeosclub.com` es la que usa la gente hoy, y sus enlaces van por otros
   * caminos: /eventos y /locales. Alguien que tenga uno guardado —o que lo
   * reciba por WhatsApp— abriría la web nueva en un 404 el día que se cambie,
   * y eso es «cambio a peor» aunque no falte ninguna función: falta una que
   * había.
   *
   * `permanent: true` porque no es un desvío temporal: esas direcciones no van
   * a volver. Así los buscadores traspasan lo que tuvieran de la vieja en vez
   * de indexar dos sitios.
   *
   * (El caso de /dj/<lo-que-sea> no cabe aquí: hace falta consultar la base
   * para traducir el nombre a un identificador, así que vive en
   * app/dj/[slug]/page.tsx.)
   */
  async redirects() {
    return [
      { source: "/eventos", destination: "/tardeos", permanent: true },
      { source: "/eventos/:id", destination: "/tardeos/:id", permanent: true },
      { source: "/locales", destination: "/colaboradores", permanent: true },
    ];
  },

  devIndicators: false,
  // Empaqueta solo lo necesario para ejecutar: imagen de Docker pequeña.
  output: "standalone",
  images: {
    // De dónde pueden venir las imágenes. Las 683 (flyers, logos de locales y
    // avatares de DJs) ya viven en nuestro propio proyecto: scripts/traer-imagenes.mjs
    // las trajo del de la app anterior.
    //
    // El host antiguo sigue permitido a propósito. La sincronización de cada
    // mañana reescribe las URLs con las del origen y el rescate las vuelve a
    // corregir en el paso siguiente del mismo workflow: durante esos minutos
    // la base apunta otra vez allí. Quitar este patrón antes de retirar la app
    // vieja dejaría la web sin imágenes en esa ventana.
    remotePatterns: [
      { protocol: "https", hostname: "fmbzcjsbyazkzsiiykto.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "obevrycebhqdqtvxnxoy.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    // Solo WebP. AVIF sale ~3 KB más pequeño en la foto de cabecera (19 vs 22)
    // y cuesta varias veces más CPU y memoria en convertir. Este droplet lleva
    // SEIS aplicaciones Next, va al 93 % de RAM y tira de 4 GB de swap: el día
    // que se activó AVIF, convertir la cabecera dejó el proceso sin responder
    // —escuchando en su puerto pero sin devolver un byte— y la web se quedaba
    // cargando. Tres kilobytes no valen eso.
    formats: ["image/webp"],
  },
  turbopack: {
    root: import.meta.dirname,
  },

  /**
   * Mientras la web viva en un dominio provisional, se le dice a Google que no
   * la indexe también por cabecera y no solo con la etiqueta del HTML: así
   * quedan cubiertos el sitemap.xml, los flyers y todo lo que no es una página.
   *
   * Se quita solo al poner PERMITIR_INDEXACION=true en el dominio definitivo.
   */
  async headers() {
    if (process.env.PERMITIR_INDEXACION === "true") return [];
    return [
      {
        source: "/:ruta*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
