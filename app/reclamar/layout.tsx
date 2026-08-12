import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Reclamar ficha");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
