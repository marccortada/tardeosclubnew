import { metadataPrivada } from "@/lib/seo";

// La página es de cliente ("use client") y no puede exportar metadata: va
// aquí. Privada (noindex): necesita sesión.
export const metadata = metadataPrivada("Escribir al DJ");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
