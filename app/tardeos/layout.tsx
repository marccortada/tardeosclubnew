import { metadataPublica } from "@/lib/seo";

/**
 * El listado es un componente de cliente y no puede exportar `metadata`, así
 * que sus datos para el buscador viven aquí.
 *
 * OJO: esto también envuelve /tardeos/[id]. La canónica de aquí la heredaría
 * cada ficha si no pusiera la suya, y todas las fiestas le dirían a Google
 * "la buena es el listado" — que es la forma más rápida de que ninguna se
 * indexe. Por eso cada ficha declara la suya en su generateMetadata.
 */
export const metadata = metadataPublica(
  "Tardeos en la costa catalana · TardeosClub",
  "Todos los tardeos de hoy y de este finde: Barcelona, Maresme, Costa Brava y alrededores. Filtra por zona, estilo de música y precio.",
  "/tardeos"
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
