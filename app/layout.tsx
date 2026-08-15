import type { Metadata, Viewport } from "next";
import { Nunito, Playfair_Display, Caveat } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
// Solo la base (posicionado y animación de agrupar/desagrupar).
// El aspecto del cluster es propio, en MapaClient.
import "leaflet.markercluster/dist/MarkerCluster.css";
import { SITE_URL, INDEXABLE } from "@/lib/seo";
import BottomNav from "@/components/BottomNav";
import SiteNav from "@/components/SiteNav";
import RegistrarSW from "@/components/RegistrarSW";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TardeosClub — Tu comunidad tardícola",
    template: "%s",
  },
  description: "El buscador de tardeos que va contigo. Sal, conecta y vive el tardeo.",
  // Cae en cascada a todas las páginas. Las privadas ya lo llevan aparte, así
  // que ponerlo aquí solo afecta a las públicas mientras el dominio no sea el
  // definitivo. Ver INDEXABLE en lib/seo.ts.
  ...(INDEXABLE ? {} : { robots: { index: false, follow: false } }),
  manifest: "/manifest.json",
  // Estas rutas se sirven crudas: next/image no las toca. Por eso apuntan a
  // los recortes de scripts/iconos.mjs y no al arte original de 3840px, que
  // convertía el favicon en una descarga de 1,4 MB en cada visita.
  icons: { icon: "/branding/icon-192.png", apple: "/branding/icon-512.png" },
  openGraph: {
    type: "website",
    siteName: "TardeosClub",
    title: "TardeosClub — Tu comunidad tardícola",
    description: "El buscador de tardeos que va contigo. Sal, conecta y vive el tardeo.",
    // 1200x630: el logo cuadrado salía recortado por los lados al compartir.
    images: [{ url: "/branding/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#E10A5A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${nunito.variable} ${playfair.variable} ${caveat.variable}`}>
      <body className="font-sans min-h-screen bg-[#f5f3f4]">
        <RegistrarSW />
        <SiteNav />
        <div className="min-h-screen pb-24 md:pb-12">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
