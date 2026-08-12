import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Mis favoritos");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
