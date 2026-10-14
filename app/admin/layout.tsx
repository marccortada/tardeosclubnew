import GuardiaAdmin from "@/components/GuardiaAdmin";
import AdminShell from "@/components/admin/AdminNav";
import { metadataPrivada } from "@/lib/seo";

// Cubre /admin y todas sus subpáginas.
export const metadata = metadataPrivada("Administración");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuardiaAdmin>
      <AdminShell>{children}</AdminShell>
    </GuardiaAdmin>
  );
}
