import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Megaphone, Store } from "lucide-react";
import { degradadoDe, inicialesDe } from "@/components/DjCard";

/** «Local fijo» o «Eventos itinerantes»: lo primero que distingue a uno de otro. */
export function tipoDeLocal(local: { tipo?: string | null }): string {
  return local.tipo === "promotor" ? "Eventos itinerantes" : "Local fijo";
}

/**
 * El logo del local, SIEMPRE sobre fondo oscuro.
 *
 * Muchos logos son PNG blancos o con fondo transparente (en la portada de la
 * app vieja iban sobre negro): sobre blanco eran invisibles. Sin logo, el
 * degradado de marca con sus iniciales, como los DJs.
 */
export function LogoLocal({
  local, sizes, priority = false, textoClase = "text-3xl", relleno = "p-[9%]",
}: {
  local: { nombre?: string | null; logo_url?: string | null; tipo?: string | null };
  sizes: string;
  priority?: boolean;
  textoClase?: string;
  /** Margen del logo dentro del recuadro: así no toca los bordes. */
  relleno?: string;
}) {
  const nombre = String(local.nombre || "").trim();
  if (local.logo_url) {
    return (
      <span className={`absolute inset-0 bg-tinta ${relleno}`}>
        <span className="relative block h-full w-full">
          <Image src={local.logo_url} alt="" fill sizes={sizes} priority={priority} className="object-contain" />
        </span>
      </span>
    );
  }
  const Icono = local.tipo === "promotor" ? Megaphone : Store;
  return (
    <span aria-hidden className="absolute inset-0 grid place-items-center" style={{ backgroundImage: degradadoDe(nombre) }}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
      {nombre ? (
        <span className={`relative font-display font-bold tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.25)] ${textoClase}`}>{inicialesDe(nombre)}</span>
      ) : (
        <Icono className="relative text-white/90" size={36} />
      )}
    </span>
  );
}

/** Tarjeta de local o promotor para el directorio y la portada. */
export default function LocalCard({ local }: { local: any }) {
  const esPromotor = local.tipo === "promotor";

  return (
    <Link
      href={`/locales/${local.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-linea bg-white shadow-tarjeta transition hover:-translate-y-0.5 hover:shadow-elevada focus-visible:outline focus-visible:outline-2 focus-visible:outline-magenta active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-tinta">
        <LogoLocal local={local} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px" textoClase="text-4xl md:text-5xl" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 md:p-4">
        <p className="line-clamp-2 break-words text-[16px] font-bold leading-snug md:text-[17px]">
          {local.nombre}
          {local.verificado && (
            <BadgeCheck size={17} className="ml-1 inline-block shrink-0 align-[-3px] text-magenta" aria-label="Verificado" />
          )}
        </p>
        {/* Un promotor no tiene zona fija: su zona es «donde toque». */}
        {!esPromotor && local.zona && (
          <span className="inline-flex min-w-0 items-center gap-1 text-[14px] font-medium text-tinta-suave">
            <MapPin size={14} className="shrink-0" aria-hidden /> <span className="truncate">{local.zona}</span>
          </span>
        )}
        <span
          className={`mt-auto inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${
            esPromotor ? "bg-magenta-50 text-magenta-700" : "bg-marfil-100 text-tinta-suave"
          }`}
        >
          {/* En la tarjeta, la versión corta: «Eventos itinerantes» partía en
              dos líneas en el móvil. La ficha lleva la larga. */}
          {esPromotor ? <Megaphone size={12} aria-hidden /> : <Store size={12} aria-hidden />} {esPromotor ? "Itinerante" : "Local fijo"}
        </span>
      </div>
    </Link>
  );
}
