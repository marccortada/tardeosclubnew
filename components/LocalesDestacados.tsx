import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Store, Megaphone, ArrowRight } from "lucide-react";

/**
 * Locales y promotores destacados en portada, en el orden que fija el admin
 * desde /admin/destacados.
 *
 * Si no hay ninguno destacado no se pinta la sección: más vale que no exista a
 * que salga un hueco vacío entre los DJs y las zonas.
 */
export default function LocalesDestacados({
  locales,
  sonDePago = true,
}: {
  locales: any[];
  /** false = no hay ninguno destacado y se enseñan los que tienen tardeos. */
  sonDePago?: boolean;
}) {
  if (!locales || locales.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 md:px-8">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="flex items-center gap-2 font-display text-2xl font-black md:text-3xl">
          {sonDePago ? "Locales destacados" : "Locales con tardeos"}
          <Store size={22} className="text-magenta" />
        </h2>
        <Link href="/colaboradores" className="inline-flex items-center gap-1 text-sm font-extrabold text-magenta">
          Ver todos <ArrowRight size={16} />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {locales.map((l) => {
          const esPromotor = l.tipo === "promotor";
          return (
            <Link
              key={l.id}
              href={`/locales/${l.id}`}
              className="flex w-28 shrink-0 flex-col items-center gap-1.5 rounded-3xl bg-white p-3 text-center shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {l.logo_url ? (
                <Image
                  src={l.logo_url}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-magenta-100"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-marca text-white">
                  {esPromotor ? <Megaphone size={26} /> : <Store size={26} />}
                </span>
              )}
              <p className="inline-flex items-center gap-0.5 text-sm font-black leading-tight line-clamp-1">
                {l.nombre}
                {l.verificado && <BadgeCheck size={13} className="shrink-0 text-oro-600" />}
              </p>
              <span className="text-xs font-bold text-tinta/50 line-clamp-1">
                {esPromotor ? "Promotor" : l.zona || " "}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
