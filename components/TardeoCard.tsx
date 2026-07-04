import Link from "next/link";
import { Tardeo, formatFecha, flyerSrc } from "@/lib/mockData";
import { MapPin, Clock, Ticket, ListChecks, Gift, ChevronRight } from "lucide-react";
import CompartirBtn from "@/components/CompartirBtn";

const entrada = {
  gratis: { label: "Gratis", icon: Gift },
  pago: { label: "Entrada", icon: Ticket },
  lista: { label: "Por lista", icon: ListChecks },
};

export default function TardeoCard({ tardeo }: { tardeo: Tardeo }) {
  const e = entrada[tardeo.tipoEntrada];
  const Icon = e.icon;
  const src = flyerSrc(tardeo);

  return (
    <Link
      href={`/tardeos/${tardeo.id}`}
      aria-label={`${tardeo.titulo}, ${formatFecha(tardeo.fecha)} en ${tardeo.local.nombre}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-tarjeta ring-1 ring-black/5 transition duration-200 active:scale-[0.99] md:hover:-translate-y-1 md:hover:shadow-xl"
    >
      {/* Flyer VERTICAL, siempre entero (contain sobre relleno difuminado) */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-tinta">
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
        />
        <img
          src={src}
          alt={`Flyer de ${tardeo.titulo}`}
          loading="lazy"
          decoding="async"
          className="relative z-10 mx-auto h-full object-contain"
        />
        {/* badge de entrada: blanco + texto oscuro = contraste alto sobre cualquier flyer */}
        <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-sm font-black text-tinta shadow-md backdrop-blur">
          <Icon size={15} className="text-magenta" /> {e.label}
          {tardeo.precio ? ` ${tardeo.precio}€` : ""}
        </span>
        {/* Compartir */}
        <CompartirBtn
          titulo={tardeo.titulo}
          texto={`¡Mira este tardeo! ${tardeo.titulo} — ${formatFecha(tardeo.fecha)} en ${tardeo.local.nombre}`}
          url={`/tardeos/${tardeo.id}`}
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-tinta shadow-md backdrop-blur transition hover:bg-white active:scale-95"
        />
      </div>

      {/* Info práctica debajo */}
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="font-script text-lg capitalize leading-none text-magenta-600">
            {formatFecha(tardeo.fecha)}
          </p>
          <h3 className="truncate font-display text-lg font-black leading-tight">{tardeo.titulo}</h3>
          <div className="mt-1 flex flex-col gap-0.5 text-sm font-semibold text-tinta/80">
            <span className="inline-flex items-center gap-1.5 truncate">
              <MapPin size={15} className="shrink-0 text-magenta" /> {tardeo.local.nombre} · {tardeo.zona}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={15} className="text-magenta" /> {tardeo.horaInicio}–{tardeo.horaFin}
            </span>
          </div>
        </div>
        <ChevronRight size={22} className="shrink-0 text-tinta/30 transition group-hover:text-magenta group-active:translate-x-0.5" />
      </div>
    </Link>
  );
}
