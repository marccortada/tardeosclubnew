import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

/**
 * Cabecera con flecha de volver para pantallas sueltas fuera de los paneles.
 * Dentro de un panel con barra lateral se usa SeccionPanel (PanelShell).
 */
export default function PanelHeader({
  titulo,
  volverHref = "/",
  children,
}: {
  titulo: string;
  volverHref?: string;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-[700] flex items-center gap-2 border-b border-linea bg-white/95 px-2 py-1.5 backdrop-blur md:px-6">
      <Link
        href={volverHref}
        aria-label="Volver"
        className="grid min-h-tacto min-w-tacto place-items-center rounded-full text-tinta transition hover:bg-marfil-100 active:scale-95"
      >
        <ArrowLeft size={22} aria-hidden />
      </Link>
      <h1 className="flex-1 truncate text-lg font-bold md:text-xl">{titulo}</h1>
      {children}
    </header>
  );
}
