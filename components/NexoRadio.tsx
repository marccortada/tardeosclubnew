import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

/**
 * Enlace a la web colaboradora.
 *
 * Deliberadamente discreto: es de otro y va suelto entre nuestro contenido, así
 * que ocupaba más que cualquier tardeo. Ahora es una fila fina —el logo, el
 * nombre y la flecha— en lugar de un bloque de 200 píxeles con degradados: sin
 * `h2`, sin la etiqueta de "web colaboradora" y sin el botón blanco, que era lo
 * que más pesaba.
 */
export default function NexoRadio() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 md:px-8">
      <a
        href="https://nexoradio.es/"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 rounded-2xl bg-black px-4 py-3 text-white transition hover:brightness-125"
      >
        <Image
          src="/branding/nexo-radio.png"
          alt=""
          width={72}
          height={72}
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
        />
        <span className="min-w-0 flex-1 text-sm font-extrabold leading-tight">
          <span className="text-[#ff2d9e]">Nexo</span> <span className="text-[#22d3ee]">Radio</span>
          <span className="ml-1.5 font-semibold text-white/45">· web colaboradora</span>
        </span>
        <ArrowUpRight size={17} className="shrink-0 text-white/50 transition group-hover:text-white" />
      </a>
    </section>
  );
}
