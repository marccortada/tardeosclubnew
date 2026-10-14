import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

/**
 * Enlace a la web colaboradora.
 *
 * Deliberadamente discreto: es de otro y va suelto entre nuestro contenido.
 * Una fila fina —logo, nombre y flecha— en lugar de un bloque llamativo.
 */
export default function NexoRadio() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 md:px-8">
      <a
        href="https://nexoradio.es/"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex min-h-tacto items-center gap-3 rounded-2xl border border-linea bg-white px-4 py-2.5 transition hover:border-linea-fuerte hover:shadow-tarjeta"
      >
        <Image src="/branding/nexo-radio.png" alt="" width={72} height={72} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
        <span className="min-w-0 flex-1 text-[15px] font-bold leading-tight">
          Nexo Radio
          <span className="ml-1.5 font-medium text-tinta-suave">· web colaboradora</span>
        </span>
        <ArrowUpRight size={18} className="shrink-0 text-tinta-suave transition group-hover:text-tinta" aria-hidden />
      </a>
    </section>
  );
}
