import type { Metadata, Viewport } from "next";
import { Nunito, Playfair_Display, Caveat } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
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

export const metadata: Metadata = {
  title: "TardeosClub — Tu comunidad tardícola",
  description: "El buscador de tardeos que va contigo. Rápido, con flow y hecho para ti.",
  manifest: "/manifest.json",
  icons: { icon: "/branding/icon.png", apple: "/branding/icon.png" },
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
