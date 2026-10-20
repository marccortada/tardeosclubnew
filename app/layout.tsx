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
import { MARCA } from "@/lib/marca";

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
    default: `${MARCA.nombre} — Tu comunidad tardícola`,
    template: "%s",
  },
  description: `El buscador de tardeos que va contigo. ${MARCA.lema}`,
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
    siteName: MARCA.nombre,
    title: `${MARCA.nombre} — Tu comunidad tardícola`,
    description: `El buscador de tardeos que va contigo. ${MARCA.lema}`,
    // 1200x630: el logo cuadrado salía recortado por los lados al compartir.
    images: [{ url: "/branding/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

// Tema antes de pintar. tc_tema = "oscuro" | "claro" eligió el usuario y
// manda; sin nada (o «sistema») sigue al sistema y escucha si cambia (el móvil
// pasa a oscuro al anochecer). Misma regla que aplicarTema() de lib/tardicola.ts.
// El MutationObserver: al pintar un «no encontrado» (notFound) React rehace el
// className de <html> con solo las fuentes y se perdía «dark»: esa página salía
// en claro con el móvil en oscuro. Si alguien cambia la clase, se vuelve a
// aplicar la preferencia (toggle con el mismo valor no cambia nada: sin bucle).
const TEMA_SCRIPT = `try{var m=matchMedia("(prefers-color-scheme: dark)"),p=function(){var t=null;try{t=localStorage.getItem("tc_tema")}catch(e){}document.documentElement.classList.toggle("dark",t==="oscuro"||(t!=="claro"&&m.matches))};p();m.addEventListener("change",p);new MutationObserver(p).observe(document.documentElement,{attributes:true,attributeFilter:["class"]})}catch(e){}`;

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
      <body className="font-sans min-h-dvh bg-fondo text-tinta antialiased">
        <RegistrarSW />
        {/* Errores del navegador → /admin/errores (lote 57). No pinta nada. */}
        <CapturaErrores />
        <ReproductorProvider>
          <SiteNav />
          <div className="min-h-dvh">{children}</div>
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
