/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No anunciar «x-powered-by: Next.js»: no ayuda a nadie y da pistas a quien busca fallos.
  poweredByHeader: false,

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
      r("/locales", "/directorio"),

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

      // (v2) /eventos es ya la pantalla de Eventos y /tardeos redirige a
      // ella: la redirección antigua /eventos → /tardeos haría un bucle.
    ];
  },

  devIndicators: false,
  // Empaqueta solo lo necesario para ejecutar: imagen de Docker pequeña.
  output: "standalone",
  images: {
    // De dónde pueden venir las imágenes: solo nuestro Storage (todas las de la
    // app anterior se trajeron a flyers/migrados/) y Unsplash. El proyecto
    // antiguo (obevrycebhqdqtvxnxoy) se borró el 20-oct-2026 y la sincronización
    // diaria que reescribía URLs hacia él está desactivada.
    remotePatterns: [
      { protocol: "https", hostname: "fmbzcjsbyazkzsiiykto.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Fotos de ambiente de la portada (Unsplash, licencia libre). Se piden ya
      // redimensionadas a su CDN y van `unoptimized`: no gastan CPU aquí.
      { protocol: "https", hostname: "images.unsplash.com" },
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
    /**
     * Cabeceras de seguridad, en TODAS las respuestas (antes no había ninguna).
     *
     * - frame-ancestors / X-Frame-Options: nadie puede meter la web dentro de un
     *   iframe ajeno y engañar a la gente para que pulse «Asistiré» o «Borrar
     *   cuenta» sin verlo (clickjacking). Los iframes que NOSOTROS ponemos
     *   (Spotify, YouTube) no se ven afectados: esto es al revés.
     * - nosniff: el navegador no «adivina» el tipo de un fichero subido.
     * - Referrer-Policy: al salir a Fourvenues o Instagram no viaja la URL
     *   completa (puede llevar ?token= de una invitación).
     * - Permissions-Policy: la ubicación solo para nuestra web (mapa, «Cerca de
     *   mí»); cámara y micro, para nadie, porque no se usan. NO se bloquea
     *   `payment`: el botón de PayPal lo necesitará cuando se conecte.
     * No va una CSP completa de scripts: Next mete scripts en línea y una mal
     * puesta deja la web en blanco. Se puede añadir más adelante con nonce.
     */
    const seguridad = [
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), usb=()" },
    ];
    const robots = process.env.PERMITIR_INDEXACION === "true"
      ? []
      : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [{ source: "/:ruta*", headers: [...seguridad, ...robots] }];
  },
};

export default nextConfig;
