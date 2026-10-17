import { ReproductorProvider, MiniReproductor } from "@/components/musica/Reproductor";
import type { Metadata, Viewport } from "next";
import { Manrope, Dancing_Script } from "next/font/google";
import "./globals.css";
// El CSS de Leaflet ya no va aquí: lo importan MapaClient y MiniMapa, así las
// pantallas sin mapa (la mayoría) no lo descargan.
import { SITE_URL, INDEXABLE } from "@/lib/seo";
import BottomNav from "@/components/BottomNav";
import SiteNav from "@/components/SiteNav";
import RegistrarSW from "@/components/RegistrarSW";
import InstalarApp from "@/components/InstalarApp";
import CapturaErrores from "@/components/CapturaErrores";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dancing = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
  weight: ["500", "700"],
  display: "swap",
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

const TEMA_SCRIPT = `try{if(localStorage.getItem("tc_tema")==="oscuro")document.documentElement.classList.add("dark")}catch(e){}`;

export const viewport: Viewport = {
  themeColor: "#D61AA8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} ${dancing.variable}`} suppressHydrationWarning>
      <head>
        {/* Tema claro/oscuro ANTES de pintar (equipo A): sin esto la página
            sale en claro y salta a oscuro, un parpadeo en cada carga. */}
        <script dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT }} />
      </head>
      <body className="font-sans min-h-screen bg-fondo text-tinta antialiased">
        <RegistrarSW />
        {/* Errores del navegador → /admin/errores (lote 57). No pinta nada. */}
        <CapturaErrores />
        <ReproductorProvider>
          <SiteNav />
          <div className="min-h-screen">{children}</div>
          <MiniReproductor />
          <BottomNav />
        {/* El aviso de instalar. Va DESPUÉS de la barra de abajo para quedar
            por encima de ella, y se pinta solo en móvil, una vez, y pasados
            unos segundos: ver el porqué de cada condición en el componente. */}
        <InstalarApp />
        </ReproductorProvider>
      </body>
    </html>
  );
}
