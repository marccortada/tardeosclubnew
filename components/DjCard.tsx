import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";
import { tieneValoracion, valoracion } from "@/lib/reputacion";

/**
 * Degradados de respaldo para quien no tiene foto. Todos salen de la paleta
 * de fiesta (rosa, morado, naranja, oro) para que una fila de DJs sin foto se
 * vea como un diseño y no como un hueco: antes era un círculo rosa con una «D».
 * El extremo claro va siempre abajo a la derecha, lejos de las iniciales.
 */
const DEGRADADOS: [string, string][] = [
  ["#D61AA8", "#F97316"],
  ["#4C1D95", "#D61AA8"],
  ["#930E72", "#F97316"],
  ["#BD1592", "#FAC72E"],
  ["#6D28D9", "#FF3DCF"],
  ["#C2410C", "#FAC72E"],
];

/** Siempre el mismo degradado para el mismo nombre: no cambia al recargar. */
export function degradadoDe(nombre: string): string {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = DEGRADADOS[h % DEGRADADOS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/**
 * Dos letras que se reconocen: «Joan & Edu» → JE, «DJ Marc» → MA. El prefijo
 * «DJ» se quita porque lo llevan media docena y saldrían todos «DM», «DT»…
 */
export function inicialesDe(nombre: string): string {
  const limpio = String(nombre || "").replace(/^\s*dj\s+/i, "").trim();
  const palabras = limpio.split(/\s+/).map((p) => p.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase();
  const una = palabras[0] || "DJ";
  return una.slice(0, 2).toUpperCase();
}

/**
 * Los estilos tal y como hay que enseñarlos. Desde la app vieja llegan a veces
 * en una sola cadena («Open Format, Progressive, Trance…»), en minúsculas o
 * repetidos; como etiquetas tienen que ir separados y limpios.
 */
export function estilosDe(raw: unknown): string[] {
  const lista = Array.isArray(raw) ? raw : [];
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const bruto of lista) {
    for (const trozo of String(bruto ?? "").split(/[,·/]| - /)) {
      const e = trozo.replace(/\.{2,}|…/g, "").trim();
      if (!e) continue;
      const bonito = e.charAt(0).toUpperCase() + e.slice(1);
      const clave = bonito.toLowerCase();
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push(bonito);
    }
  }
  return salida;
}

/**
 * Foto del DJ o, si no tiene, su degradado con iniciales. Ocupa lo que le dé
 * el contenedor (que debe ser `relative` y tener tamaño).
 */
export function AvatarDj({
  nombre, url, sizes, priority = false, textoClase = "text-4xl",
}: {
  nombre: string;
  url?: string | null;
  sizes: string;
  priority?: boolean;
  /** Tamaño de las iniciales, según lo grande que sea el avatar. */
  textoClase?: string;
}) {
  if (url) {
    return <Image src={url} alt="" fill sizes={sizes} priority={priority} className="object-cover" />;
  }
  return (
    <span
      aria-hidden
      className="absolute inset-0 grid place-items-center"
      style={{ backgroundImage: degradadoDe(nombre) }}
    >
      {/* Un brillo suave arriba para que no parezca un bloque plano. */}
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
      <span className={`relative font-display font-bold tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.25)] ${textoClase}`}>{inicialesDe(nombre)}</span>
    </span>
  );
}

/** Tarjeta de DJ: foto cuadrada grande, nombre completo y sus estilos. */
export default function DjCard({ dj }: { dj: any }) {
  const nombre = String(dj.nombre_artistico || "DJ").trim();
  const estilos = estilosDe(dj.estilos);
  const visibles = estilos.slice(0, 2);
  const resto = estilos.length - visibles.length;

  return (
    <Link
      href={`/djs/${dj.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-linea bg-white shadow-tarjeta transition hover:-translate-y-0.5 hover:shadow-elevada focus-visible:outline focus-visible:outline-2 focus-visible:outline-magenta active:scale-[0.99]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-noche">
        <AvatarDj nombre={nombre} url={dj.avatar_url} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px" textoClase="text-5xl md:text-6xl" />
        {tieneValoracion(dj.reputacion_score) && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[14px] font-bold text-tinta shadow-tarjeta">
            <Star size={14} className="text-oro" fill="currentColor" aria-hidden /> {valoracion(dj.reputacion_score)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
        <p className="line-clamp-2 break-words text-[16px] font-bold leading-snug md:text-[17px]">
          {nombre}
          {dj.verificado && (
            <BadgeCheck size={17} className="ml-1 inline-block shrink-0 align-[-3px] text-magenta" aria-label="Verificado" />
          )}
        </p>
        {visibles.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1">
            {visibles.map((e) => (
              <span key={e} className="max-w-full truncate rounded-full bg-magenta-50 px-2.5 py-0.5 text-[13px] font-semibold text-magenta-700">
                {e}
              </span>
            ))}
            {resto > 0 && (
              <span className="rounded-full bg-marfil-100 px-2 py-0.5 text-[13px] font-semibold text-tinta-suave">+{resto}</span>
            )}
          </div>
        ) : (
          <p className="mt-auto text-[14px] font-medium text-tinta-suave">DJ</p>
        )}
      </div>
    </Link>
  );
}
