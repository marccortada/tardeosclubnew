import Link from "next/link";
import Image from "next/image";
import type { Tardeo } from "@/lib/types";
import { formatFecha, flyerSrc } from "@/lib/formato";
import { MapPin, Clock, Ticket, ListChecks, Gift, ChevronRight, Navigation, Sparkles } from "lucide-react";
import { formatDistancia } from "@/lib/geo";
import CompartirBtn from "@/components/CompartirBtn";
import type { Encaje } from "@/lib/recomendar";

const entrada = {
  gratis: { label: "Gratis", icon: Gift },
  pago: { label: "Entrada", icon: Ticket },
  lista: { label: "Por lista", icon: ListChecks },
};

export default function TardeoCard({
  tardeo,
  distanciaKm,
  encaje,
  onClic,
}: {
  tardeo: Tardeo;
  /** Km hasta el visitante. Solo llega cuando ha dado su ubicación. */
  distanciaKm?: number | null;
  /**
   * Por qué este tardeo le encaja a quien lo está mirando. Solo llega desde
   * "Para ti": en un listado normal no viene a cuento, porque ahí no se ha
   * elegido nada por gustos y una insignia de compatibilidad sería mentira.
   */
  encaje?: Encaje | null;
  /** Aviso de que se ha pulsado. Solo lo usa "Para ti", para medir si sirve. */
  onClic?: () => void;
}) {
  const e = entrada[tardeo.tipoEntrada];
  const Icon = e.icon;
  const src = flyerSrc(tardeo);

  return (
    <Link
      href={`/tardeos/${tardeo.id}`}
      onClick={onClic}
      aria-label={`${tardeo.titulo}, ${formatFecha(tardeo.fecha)} en ${tardeo.local.nombre}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-tarjeta ring-1 ring-black/5 transition duration-200 active:scale-[0.99] md:hover:-translate-y-1 md:hover:shadow-xl"
    >
      {/* Flyer VERTICAL, siempre entero (contain sobre relleno difuminado) */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-tinta">
        {/* El relleno del fondo se ve difuminado, así que basta una miniatura:
            con sizes="32px" Next sirve una versión diminuta en lugar del flyer
            entero. Antes se bajaban 800 KB para enseñarlos borrosos. */}
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          fill
          sizes="32px"
          className="scale-125 object-cover opacity-70 blur-2xl"
        />
        <Image
          src={src}
          alt={`Flyer de ${tardeo.titulo}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="relative z-10 object-contain"
        />
        {/* Sello Recomendado para destacados */}
        {tardeo.destacado_hasta && new Date(tardeo.destacado_hasta) > new Date() && (
          <div className="absolute right-2 top-2 z-20 w-12 h-12 md:w-16 md:h-16 pointer-events-none">
            <Image
              src="/branding/SELLO VERIFICADO_TARDEOSCLUB.png"
              alt="Sello Recomendado"
              fill
              className="object-contain"
            />
          </div>
        )}
        {/* badge de entrada: blanco + texto oscuro = contraste alto sobre cualquier flyer */}
        {/* Con tope de ancho: "Entrada 10€" crecía hasta meterse debajo del
            botón de compartir, y se leía "Entrada 10" con un círculo encima. */}
        <span className="absolute left-3 top-3 z-20 inline-flex max-w-[calc(100%-4.25rem)] items-center gap-1.5 truncate rounded-full bg-white/95 px-3 py-1.5 text-sm font-black text-tinta shadow-md backdrop-blur">
          <Icon size={15} className="text-magenta" /> {e.label}
          {tardeo.precio ? ` ${tardeo.precio}€` : ""}
        </span>
        {/*
          Por qué te lo proponemos. Abajo y no arriba: arriba ya están el precio
          y el compartir, y una tercera pastilla ahí tapaba media cara del flyer.

          El porcentaje solo si el motor lo da (hacen falta tres criterios
          comparados). Cuando no lo da pero sí hay motivos, se enseña el motivo
          a secas: "Te gusta el Deep House" es igual de útil y no se inventa una
          precisión que no existe.
        */}
        {encaje && (encaje.compatibilidad !== null || encaje.motivos.length > 0) && (
          <span
            title={encaje.motivos.join(" · ")}
            className="absolute bottom-3 left-3 z-20 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-marca px-3 py-1.5 text-sm font-black text-white shadow-md"
          >
            <Sparkles size={14} className="shrink-0" />
            <span className="truncate">
              {encaje.compatibilidad !== null
                ? `${encaje.compatibilidad}% para ti`
                : encaje.motivos[0]}
            </span>
          </span>
        )}

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
          <p className="font-script text-lg leading-none text-magenta-600">
            {formatFecha(tardeo.fecha)}
          </p>
          {/* Dos líneas, no puntos suspensivos. En el listado son dos columnas de
              104 px de texto: ahí no cabe ni "NOSE tardeo", y TODOS los títulos
              salían cortados a mitad de palabra ("NOSE tar…", "Sunset Da…"). */}
          {/* min-h de dos líneas: con `line-clamp-2` los títulos de una línea
              dejaban la tarjeta 22 px más baja, y en una rejilla eso hace que
              cada fila mida distinto y los bordes no cuadren. */}
          <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-lg font-black leading-tight">{tardeo.titulo}</h3>
          <div className="mt-1 flex flex-col gap-0.5 text-sm font-semibold text-tinta/80">
            <span className="inline-flex items-center gap-1.5 truncate">
              {/* Se unen solo las partes que existen. Con `nombre · zona` fijo,
                  un local sin nombre —o uno que la consulta pública no puede
                  leer porque está en borrador— dejaba un "· Mataró" huérfano
                  en la tarjeta, que es de las cosas que más cantan. */}
              <MapPin size={15} className="shrink-0 text-magenta" />{" "}
              {[tardeo.local.nombre, tardeo.zona].filter(Boolean).join(" · ") || "Sin ubicación"}
            </span>
            {distanciaKm != null && (
              <span className="inline-flex items-center gap-1.5 font-black text-magenta">
                <Navigation size={14} className="shrink-0" /> a {formatDistancia(distanciaKm)}
              </span>
            )}
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
