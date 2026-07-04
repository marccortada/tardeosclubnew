import Link from "next/link";
import { MapPin } from "lucide-react";

export default function ZonasRapidas({ zonas }: { zonas: { zona: string; n: number }[] }) {
  if (zonas.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-9 md:px-8 md:pt-14">
      <h2 className="mb-4 font-display text-2xl font-black md:text-4xl">Explora por zona</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {zonas.map(({ zona, n }) => (
          <Link
            key={zona}
            href={`/tardeos?zona=${encodeURIComponent(zona)}`}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marca text-white">
              <MapPin size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-black leading-tight">{zona}</span>
              <span className="text-sm font-semibold text-tinta/60">
                {n} tardeo{n === 1 ? "" : "s"}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
