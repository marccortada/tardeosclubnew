import { metadataPublica } from "@/lib/seo";
import { MARCA } from "@/lib/marca";

export const metadata = metadataPublica(
  `Mapa de tardeos · ${MARCA.nombre}`,
  "Los tardeos de la costa catalana en el mapa, agrupados por pueblo y ciudad. Encuentra el que tienes más cerca.",
  "/mapa"
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
