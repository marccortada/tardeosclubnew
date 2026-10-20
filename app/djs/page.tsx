import type { Metadata } from "next";
import { metadataPublica } from "@/lib/seo";
import FeedDjs from "./FeedDjs";
import { MARCA } from "@/lib/marca";

// Con canónica e imagen al compartir (helper común de lib/seo.ts).
export const metadata: Metadata = metadataPublica(
  `DJs · ${MARCA.nombre}`,
  "Descubre DJs y sus sets, síguelos y mira dónde pinchan.",
  "/djs"
);

/**
 * Pestaña DJs (dossier pág. 7): feed vertical a pantalla completa. El
 * directorio de DJs (rejilla) vive ahora en /directorio (equipo A).
 */
export default function PaginaDjs() {
  return <FeedDjs />;
}
