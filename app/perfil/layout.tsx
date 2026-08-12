import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Mi cuenta");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
