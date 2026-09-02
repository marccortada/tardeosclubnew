import Link from "next/link";
import { ReactNode } from "react";
import { Tardeo } from "@/lib/types";
import TardeoCard from "./TardeoCard";
import type { Encaje } from "@/lib/recomendar";

export default function CarruselTardeos({
  titulo,
  tardeos,
  href = "/tardeos",
  encajes,
  onClicTarjeta,
}: {
  titulo: ReactNode;
  tardeos: Tardeo[];
  href?: string;
  /** Por qué encaja cada uno, por id. Solo lo manda "Para ti". */
  encajes?: Map<string, Encaje>;
  /** Se llama al pulsar una tarjeta, con su id. Solo lo usa "Para ti". */
  onClicTarjeta?: (id: string) => void;
}) {
  if (!tardeos || tardeos.length === 0) return null;
  return (
    <section className="pt-7 md:pt-12">
      <div className="mx-auto mb-4 flex max-w-6xl items-end justify-between px-4 md:px-8">
        <h2 className="flex items-center gap-2 font-display text-2xl font-black md:text-4xl">{titulo}</h2>
        {/* Con padding: era un enlace de 20 px de alto, la mitad del mínimo
            que se puede tocar con el pulgar sin fallar. */}
        <Link href={href} className="-mr-2 rounded-lg px-2 py-2.5 text-sm font-extrabold text-magenta transition hover:text-magenta-700 md:text-base">
          Ver todos
        </Link>
      </div>
      {/* 62% del ancho y no 80%: a pantalla completa una tarjeta con flyer
          4:5 se come casi todo el móvil, y encima no se ve que haya más
          detrás. Así asoma la siguiente, que es lo que invita a deslizar. */}
      <div className="no-scrollbar carousel-bleed flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {tardeos.map((t) => (
          <div key={t.id} className="w-[62%] shrink-0 snap-start sm:w-64 md:w-72">
            <TardeoCard tardeo={t} encaje={encajes?.get(t.id)} onClic={onClicTarjeta ? () => onClicTarjeta(t.id) : undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}
