"use client";

import "./globals.css";
import PantallaError from "@/components/PantallaError";
import { MARCA } from "@/lib/marca";

/**
 * Error en el propio layout raíz: sustituye a TODO el documento, por eso
 * lleva su <html> y <body> y vuelve a importar los estilos. La fuente es la
 * del sistema: cargar Manrope aquí añade otra cosa que puede fallar.
 */
export default function ErrorGlobal({
  error, retry, reset,
}: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-marfil font-sans text-tinta antialiased">
        {/* Un solo texto: <title> no admite varios hijos. */}
        <title>{`Algo ha fallado · ${MARCA.nombre}`}</title>
        <PantallaError error={error} reintentar={retry ?? reset} />
      </body>
    </html>
  );
}
