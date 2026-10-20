import { metadataPublica } from "@/lib/seo";
import { MARCA } from "@/lib/marca";

export const metadata = metadataPublica(
  `Directorio · ${MARCA.nombre}`,
  "Locales, promotores y DJs de los tardeos de la costa catalana.",
  "/directorio"
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
