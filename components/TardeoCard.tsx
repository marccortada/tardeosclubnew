import Link from "next/link";
import Image from "next/image";
import type { Tardeo } from "@/lib/types";
import { formatFecha, flyerSrc } from "@/lib/formato";
import { hoyEnEspana, diasEntre } from "@/lib/fechas";
import { MapPin, Clock, Navigation, Sparkles, Star } from "lucide-react";
import { formatDistancia } from "@/lib/geo";
import CompartirBtn from "@/components/CompartirBtn";
import type { Encaje } from "@/lib/recomendar";

/**
 * La fecha del chip del flyer, en tres piezas: "SÁB" / "18" / "OCT".
 *
 * En bloque blanco y con el número grande porque es lo primero que se busca y
 * tiene que leerse encima de cualquier flyer, por cargado que venga. Hoy y
 * mañana se dicen con palabras: nadie quiere calcular qué día es el 18.
 */
function partesFecha(iso: string): { arriba: string; dia: string; mes: string; relativo: boolean } {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  const corto = (o: Intl.DateTimeFormatOptions) =>
    fecha.toLocaleDateString("es-ES", { ...o, timeZone: "UTC" }).replace(".", "").toUpperCase();
  const dias = diasEntre(hoyEnEspana(), iso);
  const relativo = dias === 0 || dias === 1;
  return {
    arriba: dias === 0 ? "HOY" : dias === 1 ? "MAÑANA" : corto({ weekday: "short" }),
    dia: String(d),
    // "SEPT" → "SEP": tres letras, como todos los demás meses.
    mes: corto({ month: "short" }).slice(0, 3),
    relativo,
  };
}

/** "Gratis", "Lista · 12 €", "12 €" o "Con entrada". Sin precio no se inventa. */
function textoPrecio(t: Tardeo): string {
  if (t.tipoEntrada === "gratis") return "Gratis";
  if (t.tipoEntrada === "lista") return t.precio ? `Lista · ${t.precio} €` : "Por lista";
  return t.precio ? `${t.precio} €` : "Con entrada";
}

/**
 * Tarjeta de cartel: el flyer manda (4:5, entero) y debajo, sin caja, lo justo
 * para decidir: título, dónde, hora y precio. Es el patrón de las webs de
 * planes que la gente ya conoce, y deja que cada flyer luzca sin competir con
 * un marco.
 *
 * Sin corazón de favorito a propósito: saber si cada tarjeta está guardada
 * pediría una consulta por tarjeta. Se guarda desde la ficha, que ya lo hace.
 */
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
  const src = flyerSrc(tardeo);
  const f = partesFecha(tardeo.fecha);
  const hora = tardeo.horaInicio ? `${tardeo.horaInicio}${tardeo.horaFin ? `–${tardeo.horaFin}` : ""}` : "";
  const dondeTxt = [tardeo.local.nombre, tardeo.zona].filter(Boolean).join(" · ");
  const conEncaje = encaje && (encaje.compatibilidad !== null || encaje.motivos.length > 0);

  return (
    <Link
      href={`/tardeos/${tardeo.id}`}
      onClick={onClic}
      aria-label={`${tardeo.titulo}, ${formatFecha(tardeo.fecha)} en ${tardeo.local.nombre}`}
      className="group flex h-full flex-col rounded-2xl outline-offset-4"
    >
      {/* El flyer, SIEMPRE entero (contain sobre un relleno difuminado): cada
          local lo diseña a su manera y recortarlo se come la fecha o el DJ. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-marfil-200 shadow-tarjeta ring-1 ring-black/5 transition duration-300 md:group-hover:-translate-y-1 md:group-hover:shadow-elevada">
        {/* El relleno se ve difuminado: con una miniatura basta (sizes 32px). */}
        <Image src={src} alt="" aria-hidden="true" fill sizes="32px" className="scale-125 object-cover opacity-70 blur-2xl" />
        <Image
          src={src}
          alt={`Flyer de ${tardeo.titulo}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="relative z-10 object-contain transition duration-500 md:group-hover:scale-[1.03]"
        />

        {/* Fecha en bloque blanco, arriba a la izquierda. Es lo único que va
            encima del flyer además de compartir: el precio baja al texto para
            no taparle media cabecera al cartel. */}
        <div className="absolute left-2.5 top-2.5 z-20 flex min-w-[46px] flex-col items-center rounded-xl bg-white px-1.5 py-1 md:min-w-[52px] md:px-2 md:py-1.5 text-center leading-none text-tinta shadow-elevada md:left-3 md:top-3">
          <span className={`text-[13px] font-extrabold tracking-wide ${f.relativo ? "text-magenta-700" : "text-tinta-suave"}`}>{f.arriba}</span>
          <span className="text-[22px] font-extrabold tracking-tight md:mt-0.5">{f.dia}</span>
          <span className="text-[13px] font-bold tracking-wide text-tinta-suave md:mt-0.5">{f.mes}</span>
        </div>

        <CompartirBtn
          titulo={tardeo.titulo}
          texto={`¡Mira este tardeo! ${tardeo.titulo} — ${formatFecha(tardeo.fecha)} en ${tardeo.local.nombre}`}
          url={`/tardeos/${tardeo.id}`}
          className="absolute right-2 top-2 z-20 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-tinta shadow-tarjeta transition hover:bg-superficie active:scale-95"
        />

        {/* Abajo: destacado y, solo en "Para ti", por qué te lo proponemos.
            El porcentaje solo si el motor lo da: no se inventa precisión. */}
        {(tardeo.destacado || conEncaje) && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex flex-col items-start gap-1.5">
            {tardeo.destacado && (
              <span className="inline-flex items-center gap-1 rounded-full bg-oro px-2.5 py-1 text-[13px] font-bold text-sobre-oro shadow-tarjeta">
                <Star size={13} fill="currentColor" aria-hidden /> Destacado
              </span>
            )}
            {conEncaje && (
              <span
                title={encaje!.motivos.join(" · ")}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-magenta px-2.5 py-1 text-[13px] font-bold text-white shadow-tarjeta"
              >
                <Sparkles size={13} className="shrink-0" aria-hidden />
                <span className="truncate">
                  {encaje!.compatibilidad !== null ? `${encaje!.compatibilidad}% para ti` : encaje!.motivos[0]}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-0.5 pt-3">
        {/* Dos líneas, no puntos suspensivos a mitad de palabra. El min-h
            iguala las alturas de una misma fila de la rejilla. */}
        <h3 className="line-clamp-2 min-h-[2.6rem] text-[16px] font-bold leading-snug text-tinta transition group-hover:text-magenta-700 md:text-[17px]">
          {tardeo.titulo}
        </h3>
        {/* Solo las partes que existen: un local en borrador llega sin nombre
            y dejaba un "· Mataró" huérfano. */}
        <p className="flex items-center gap-1 text-[14px] font-medium text-tinta-suave md:text-[15px]">
          <MapPin size={15} className="shrink-0" aria-hidden />
          <span className="truncate">{dondeTxt || "Sin ubicación"}</span>
        </p>
        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5 text-[14px] md:text-[15px]">
          {hora && (
            <span className="inline-flex items-center gap-1 font-medium text-tinta-suave">
              <Clock size={14} className="shrink-0" aria-hidden /> {hora}
            </span>
          )}
          <span className={`font-bold ${tardeo.tipoEntrada === "gratis" ? "text-ok" : "text-tinta"}`}>{textoPrecio(tardeo)}</span>
        </p>
        {distanciaKm != null && (
          <p className="flex items-center gap-1 text-[14px] font-bold text-tinta">
            <Navigation size={14} className="shrink-0 text-magenta" aria-hidden /> a {formatDistancia(distanciaKm)}
          </p>
        )}
      </div>
    </Link>
  );
}
