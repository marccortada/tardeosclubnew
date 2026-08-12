import GuardiaAdmin from "@/components/GuardiaAdmin";
import { metadataPrivada } from "@/lib/seo";

// Cubre /admin y todas sus subpáginas.
export const metadata = metadataPrivada("Administración");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <GuardiaAdmin>{children}</GuardiaAdmin>;
}
