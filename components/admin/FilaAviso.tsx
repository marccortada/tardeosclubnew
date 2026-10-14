import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

/**
 * Una fila tocable con un número: lo que espera al admin y adónde ir.
 * `valor` null = no se pudo leer (se enseña "—", nunca un 0 que engañe).
 * `urgente` resalta el número en magenta cuando hay algo pendiente.
 */
export default function FilaAviso({
  href, icono, titulo, sub, valor, urgente = true,
}: { href: string; icono: ReactNode; titulo: string; sub?: string; valor: number | null; urgente?: boolean }) {
  const hay = (valor ?? 0) > 0 && urgente;
  return (
    <Link href={href}
      className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta transition-colors hover:border-linea-fuerte hover:bg-marfil">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">{icono}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold leading-tight">{titulo}</span>
        {sub && <span className="mt-0.5 block text-[15px] text-tinta-suave">{sub}</span>}
      </span>
      <span className={`grid min-w-[44px] place-items-center rounded-full px-3 py-1 text-lg font-bold ${hay ? "bg-magenta text-white" : "bg-marfil-100 text-tinta-suave"}`}
        aria-label={valor === null ? "sin datos" : `${valor} pendientes`}>
        {valor === null ? "—" : valor}
      </span>
      <ChevronRight size={20} className="shrink-0 text-tinta-suave" aria-hidden />
    </Link>
  );
}
