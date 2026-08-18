import { urlIncrustada, altoDelReproductor } from "@/lib/djs";
import { Music2, ExternalLink } from "lucide-react";

/**
 * La playlist de un local, promotor o DJ.
 *
 * Se incrusta si es de Spotify, SoundCloud, Mixcloud o YouTube; cualquier otra
 * cosa se enseña como enlace. Un reproductor roto ocupando media ficha es peor
 * que un enlace que funciona.
 *
 * Sin playlist no se pinta nada: un hueco con el título puesto hace parecer que
 * al sitio le falta algo cuando simplemente no la ha puesto.
 */
export default function Playlist({ url, titulo = "Su música" }: { url?: string | null; titulo?: string }) {
  const u = (url ?? "").trim();
  if (!u) return null;
  const incrustar = urlIncrustada(u);

  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-black md:text-2xl">
        <Music2 size={22} className="text-magenta" /> {titulo}
      </h2>
      {incrustar ? (
        <iframe
          src={incrustar}
          title={titulo}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className={`w-full overflow-hidden rounded-2xl ${altoDelReproductor(u)}`}
        />
      ) : (
        <a
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-extrabold text-magenta shadow-tarjeta ring-1 ring-magenta-100"
        >
          <Music2 size={18} /> Escuchar <ExternalLink size={14} />
        </a>
      )}
    </section>
  );
}
