import type { Metadata } from "next";
import FeedDjs from "./FeedDjs";

export const metadata: Metadata = {
  title: "DJs · TardeosClub",
  description: "Descubre DJs y sus sets, síguelos y mira dónde pinchan.",
};

/**
 * Pestaña DJs (dossier pág. 7): feed vertical a pantalla completa. El
 * directorio de DJs (rejilla) vive ahora en /directorio (equipo A).
 */
export default function PaginaDjs() {
  return <FeedDjs />;
}
