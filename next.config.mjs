/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
