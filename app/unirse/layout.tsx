import { metadataPrivada } from "@/lib/seo";

export const metadata = metadataPrivada("Únete");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
