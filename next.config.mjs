/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Empaqueta solo lo necesario para ejecutar: imagen de Docker pequeña.
  output: "standalone",
  images: {
    // De dónde pueden venir los flyers. Los dos son buckets públicos de
    // Supabase: el nuestro y —ojo— el de la app anterior, de donde salen 23 de
    // los 26 flyers migrados. Mientras esa dependencia exista, ese proyecto no
    // se puede pausar ni borrar sin quedarnos sin imágenes.
    remotePatterns: [
      { protocol: "https", hostname: "fmbzcjsbyazkzsiiykto.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "obevrycebhqdqtvxnxoy.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    // Los flyers son fotografías: AVIF y WebP recortan muchísimo frente al JPEG
    // original, que llega a pesar 800 KB para enseñarse en 300 píxeles.
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
