import Link from "next/link";
import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Tardeo } from "@/lib/types";
import TardeoCard from "./TardeoCard";
import type { Encaje } from "@/lib/recomendar";

export default function CarruselTardeos({
  titulo,
  subtitulo,
  tardeos,
  href = "/tardeos",
  encajes,
  onClicTarjeta,
}: {
  titulo: ReactNode;
  /** Una línea debajo del título que diga qué es esta fila. */
  subtitulo?: ReactNode;
  tardeos: Tardeo[];
  href?: string;
  /** Por qué encaja cada uno, por id. Solo lo manda "Para ti". */
  encajes?: Map<string, Encaje>;
  /** Se llama al pulsar una tarjeta, con su id. Solo lo usa "Para ti". */
  onClicTarjeta?: (id: string) => void;
}) {
  if (!tardeos || tardeos.length === 0) return null;
  return (
    <section className="pt-10 md:pt-14">
      <CabeceraSeccion titulo={titulo} subtitulo={subtitulo} href={href} />
      {/*
        Rejilla centrada, no carrusel: como en tardeosclub.com. Un carrusel
        esconde la mitad de los planes detrás de un gesto que hay que adivinar;
        en rejilla se ven todos de un vistazo. Con flex-wrap y no con grid para
        que una fila incompleta quede centrada y no pegada a la izquierda.
      */}
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-3 gap-y-6 px-4 sm:gap-x-5 md:gap-y-8 md:px-8">
        {tardeos.map((t) => (
          <div key={t.id} className="w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.834rem)] lg:w-[calc(25%-0.9375rem)]">
            <TardeoCard tardeo={t} encaje={encajes?.get(t.id)} onClic={onClicTarjeta ? () => onClicTarjeta(t.id) : undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Título de sección de la web pública + enlace "Ver todos" (48 px de alto). */
export function CabeceraSeccion({
  titulo, subtitulo, href, textoEnlace = "Ver todos",
}: { titulo: ReactNode; subtitulo?: ReactNode; href?: string; textoEnlace?: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-6xl items-end justify-between gap-3 px-4 md:px-8">
      <div className="min-w-0">
        <h2 className="font-display text-[26px] font-bold leading-tight md:text-[34px]">{titulo}</h2>
        {subtitulo && <p className="mt-1 text-[15px] text-tinta-suave">{subtitulo}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="-mr-2 inline-flex min-h-tacto shrink-0 items-center gap-1 rounded-xl px-2 text-[15px] font-bold text-magenta transition hover:bg-magenta-50"
        >
          {textoEnlace} <ArrowRight size={17} aria-hidden />
        </Link>
      )}
    </div>
  );
}
