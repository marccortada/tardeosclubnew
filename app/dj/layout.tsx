import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Mi perfil DJ");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
