import { urlIncrustada, altoDelReproductor } from "@/lib/djs";
import { Music2, ExternalLink } from "lucide-react";
import { urlSegura } from "@/lib/enlaces";

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
  // Si no se puede incrustar y el enlace tampoco es seguro, no se pinta nada:
  // un botón que no lleva a ningún sitio es peor que no tenerlo.
  const destino = incrustar ? null : urlSegura(u);
  if (!incrustar && !destino) return null;

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 font-display text-[24px] font-bold leading-tight md:text-[30px]">
        <Music2 size={22} className="text-magenta" /> {titulo}
      </h2>
      {incrustar ? (
        <iframe
          src={incrustar}
          title={titulo}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className={`w-full overflow-hidden rounded-2xl border border-linea ${altoDelReproductor(u)}`}
        />
      ) : (
        <a
          /* La playlist la escribe el local en su editor: se valida el destino
             igual que las redes, por lo mismo. */
          href={destino ?? undefined}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex min-h-tacto items-center gap-2 rounded-xl border border-linea-fuerte bg-white px-5 py-3 text-base font-bold text-magenta-700 transition-colors hover:bg-marfil"
        >
          <Music2 size={18} /> Escuchar <ExternalLink size={14} />
        </a>
      )}
    </section>
  );
}
