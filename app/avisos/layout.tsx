import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Avisos");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
