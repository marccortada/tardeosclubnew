import type { Metadata, Viewport } from "next";
import { Nunito, Playfair_Display, Caveat } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
// Solo la base (posicionado y animación de agrupar/desagrupar).
// El aspecto del cluster es propio, en MapaClient.
import "leaflet.markercluster/dist/MarkerCluster.css";
import BottomNav from "@/components/BottomNav";
import SiteNav from "@/components/SiteNav";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.tardeosclub.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TardeosClub — Tu comunidad tardícola",
    template: "%s",
  },
  description: "El buscador de tardeos que va contigo. Sal, conecta y vive el tardeo.",
  manifest: "/manifest.json",
  icons: { icon: "/branding/icon.png", apple: "/branding/icon.png" },
  openGraph: {
    type: "website",
    siteName: "TardeosClub",
    title: "TardeosClub — Tu comunidad tardícola",
    description: "El buscador de tardeos que va contigo. Sal, conecta y vive el tardeo.",
    images: [{ url: "/branding/logo.png" }],
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
        <SiteNav />
        <div className="min-h-screen pb-24 md:pb-12">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
