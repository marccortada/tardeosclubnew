import { metadataPrivada } from "@/lib/seo";
import PanelLocal from "./_panel/PanelLocal";

export const metadata = metadataPrivada("Mi local");

// Todo /local va dentro del panel con barra lateral; la ficha se carga una vez
// en PanelLocal y la comparten las secciones (ver usePanelLocal).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PanelLocal>{children}</PanelLocal>;
}
