/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Empaqueta solo lo necesario para ejecutar: imagen de Docker pequeña.
  output: "standalone",
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
