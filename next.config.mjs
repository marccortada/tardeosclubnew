/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Las direcciones de tardeosclub.com que aquí no existen.
   *
   * La lista no está adivinada: sale del propio bundle de la web actual, que
   * declara sus 21 rutas. De ellas, TRECE daban 404 aquí. No falta ninguna
   * función —todas tienen su equivalente— pero el día que se cambie el
   * dominio, quien tenga un enlace guardado se come una página que no existe,
   * y eso es «cambio a peor» sin haber quitado nada.
   *
   * DOS SON DELICADAS, y son las que de verdad justifican este bloque:
   *
   *   /reset-password  -> está DENTRO de correos ya enviados. Supabase manda
   *      el enlace de recuperar contraseña a la dirección que le diga la app,
   *      y la actual le dice esa. Sin redirección, alguien que pida su
   *      contraseña hoy y la abra pasado mañana se queda fuera de su cuenta.
   *      El token viaja en el fragmento (#access_token=…), que el navegador
   *      conserva al seguir la redirección: llega igual.
   *
   *   /onboarding/:token -> las invitaciones para reclamar una ficha. Mismo
   *      caso: enlaces ya repartidos. Aquí el testigo va en la ruta y allí en
   *      la consulta, así que se traduce.
   *
   * `permanent: true` porque no es un desvío temporal: estas direcciones no
   * van a volver, y así los buscadores traspasan lo que tuvieran en vez de
   * indexar dos sitios.
   *
   * (El caso de /dj/<lo-que-sea> no cabe aquí: hace falta consultar la base
   * para traducir el nombre a un identificador, así que vive en
   * app/dj/[slug]/page.tsx.)
   */
  async redirects() {
    const r = (source, destination) => ({ source, destination, permanent: true });
    return [
      // Navegación
      r("/map", "/mapa"),
      r("/profile", "/perfil"),
      r("/locales", "/colaboradores"),

      // Entrar y darse de alta. Todas caen en /perfil, que es donde vive el
      // acceso en esta app; las de registro con rol, en /unirse, que pregunta
      // qué eres antes de crear nada.
      r("/auth", "/perfil"),
      r("/register", "/perfil"),
      r("/forgot-password", "/perfil"),
      r("/reset-password", "/perfil"),
      r("/register-dj", "/unirse"),
      r("/register-venue", "/unirse"),
      r("/register-dj-venue", "/unirse"),

      // Paneles
      r("/venue-dashboard", "/local"),
      r("/dj-dashboard", "/dj"),
      r("/pending-approval", "/local"),
      r("/admin-access", "/admin"),

      // Invitaciones ya repartidas: el testigo pasa de la ruta a la consulta.
      { source: "/onboarding/:token", destination: "/reclamar?token=:token", permanent: true },

      // Esta no existía en la web actual: se deja porque es lo que teclea
      // cualquiera en castellano y no cuesta nada.
      r("/eventos", "/tardeos"),
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
