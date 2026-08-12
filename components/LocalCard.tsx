import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Store, Megaphone, MapPin } from "lucide-react";

/** Tarjeta de local o promotor para el directorio de colaboradores. */
export default function LocalCard({ local }: { local: any }) {
  const esPromotor = local.tipo === "promotor";

  return (
    <Link
      href={`/locales/${local.id}`}
      className="flex flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.99]"
    >
      {local.logo_url ? (
        <Image
          src={local.logo_url}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 rounded-2xl object-cover ring-2 ring-magenta-100"
        />
      ) : (
        <span className="grid h-20 w-20 place-items-center rounded-2xl bg-marca text-white">
          {esPromotor ? <Megaphone size={34} /> : <Store size={34} />}
        </span>
      )}

      <p className="inline-flex items-center gap-1 font-display text-base font-black leading-tight line-clamp-2">
        {local.nombre}
        {local.verificado && <BadgeCheck size={15} className="shrink-0 text-oro-600" />}
      </p>

      {/* Un promotor no tiene zona fija, así que en su hueco va lo que sí lo
          define: que organiza en sitios distintos. */}
      {esPromotor ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-magenta-50 px-2.5 py-0.5 text-xs font-black text-magenta">
          <Megaphone size={11} /> Promotor
        </span>
      ) : (
        local.zona && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-tinta/60">
            <MapPin size={12} className="text-magenta" /> {local.zona}
          </span>
        )
      )}
    </Link>
  );
}
