import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

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
    <header className="sticky top-0 z-[700] flex items-center gap-3 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur-md md:px-8">
      <Link
        href={volverHref}
        aria-label="Volver"
        className="grid h-10 w-10 place-items-center rounded-full text-tinta transition hover:bg-black/5 active:scale-95"
      >
        <ArrowLeft size={22} />
      </Link>
      <h1 className="flex-1 truncate font-display text-xl font-black md:text-2xl">{titulo}</h1>
      {children}
    </header>
  );
}
