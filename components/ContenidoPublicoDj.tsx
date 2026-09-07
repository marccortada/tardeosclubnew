import Image from "next/image";
import { urlSegura } from "@/lib/enlaces";
import { getContenidos, urlIncrustada, type Contenido } from "@/lib/djs";
import { Music2, Video, ExternalLink } from "lucide-react";

/**
 * Lo que el DJ ha subido, en su ficha pública.
 *
 * Las sesiones y vídeos de SoundCloud, Mixcloud o YouTube se incrustan; lo que
 * no se reconoce se enseña como enlace. Un enlace que funciona vale más que un
 * reproductor roto ocupando media pantalla.
 *
 * Si no ha subido nada no se pinta la sección: un apartado vacío en una ficha
 * pública hace parecer que al DJ le falta algo.
 */
export default async function ContenidoPublicoDj({ djId }: { djId: string }) {
  const todo = await getContenidos(djId);
  if (!todo.length) return null;

  const medios = todo.filter((c) => c.tipo === "sesion" || c.tipo === "video");
  const imagenes = todo.filter((c) => c.tipo === "foto" || c.tipo === "flyer");

  return (
    <>
      {medios.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-black md:text-2xl">
            <Music2 size={22} className="text-magenta" /> Sesiones y vídeos
          </h2>
          <div className="flex flex-col gap-3">
            {medios.map((c: Contenido) => {
              const incrustar = urlIncrustada(c.url);
              return (
                <div key={c.id} className="overflow-hidden rounded-2xl bg-white shadow-tarjeta ring-1 ring-black/5">
                  {c.titulo && <p className="px-4 pt-3 font-black leading-tight">{c.titulo}</p>}
                  {incrustar ? (
                    <iframe
                      src={incrustar}
                      title={c.titulo ?? "Sesión"}
                      loading="lazy"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      className={`w-full ${c.tipo === "video" ? "aspect-video" : "h-[166px]"}`}
                    />
                  ) : (
                    /* El destino lo escribe el DJ en su panel, así que se
                       comprueba antes de pintarlo: un `javascript:` guardado en
                       la base sería un enlace ejecutable en una ficha pública. */
                    <a href={urlSegura(c.url) ?? "#"} target="_blank" rel="noopener noreferrer nofollow"
                      className="flex items-center gap-2 p-4 font-extrabold text-magenta">
                      {c.tipo === "video" ? <Video size={18} /> : <Music2 size={18} />}
                      Escuchar / ver <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {imagenes.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 font-display text-xl font-black md:text-2xl">Galería</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {imagenes.map((c) => (
              /* `aria-label` porque dentro solo hay una imagen, y su `alt` se
                 queda vacío cuando el DJ no le puso título: entonces el enlace
                 no tiene NINGÚN nombre y un lector de pantalla solo dice
                 "enlace". Con título se usa el título. */
              <a key={c.id} href={urlSegura(c.url) ?? "#"} target="_blank" rel="noopener noreferrer nofollow"
                aria-label={c.titulo ? `Ver «${c.titulo}» a tamaño completo` : "Ver la foto a tamaño completo"}
                className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-black/5">
                <Image src={c.url} alt={c.titulo ?? ""} fill sizes="(max-width: 640px) 33vw, 200px"
                  className="object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
