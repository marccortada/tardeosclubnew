import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Valorar el tardeo");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
