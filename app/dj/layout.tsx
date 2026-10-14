import { metadataPrivada } from "@/lib/seo";
import PanelDj from "./contexto";

export const metadata = metadataPrivada("Mi perfil DJ");

/**
 * Panel del DJ con barra lateral. La carga de la ficha y los estados sin
 * sesión / sin ficha viven en ./contexto. Las rutas antiguas /dj/<slug>
 * también pasan por aquí, pero PanelDj las deja pasar tal cual (redirigen).
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PanelDj>{children}</PanelDj>;
}
