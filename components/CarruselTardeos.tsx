import Link from "next/link";
import { ReactNode } from "react";
import { Tardeo } from "@/lib/types";
import TardeoCard from "./TardeoCard";

export default function CarruselTardeos({
  titulo,
  tardeos,
  href = "/tardeos",
}: {
  titulo: ReactNode;
  tardeos: Tardeo[];
  href?: string;
}) {
  if (!tardeos || tardeos.length === 0) return null;
  return (
    <section className="pt-7 md:pt-12">
      <div className="mx-auto mb-4 flex max-w-6xl items-end justify-between px-4 md:px-8">
        <h2 className="flex items-center gap-2 font-display text-2xl font-black md:text-4xl">{titulo}</h2>
        <Link href={href} className="text-sm font-extrabold text-magenta transition hover:text-magenta-700 md:text-base">
          Ver todos
        </Link>
      </div>
      <div className="no-scrollbar carousel-bleed flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {tardeos.map((t) => (
          <div key={t.id} className="w-[80%] shrink-0 snap-start sm:w-72 md:w-80">
            <TardeoCard tardeo={t} />
          </div>
        ))}
      </div>
    </section>
  );
}
