import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Próxima Parada");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
