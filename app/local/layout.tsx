import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Mi local");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
