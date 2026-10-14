import DjCard from "@/components/DjCard";
import { CabeceraSeccion } from "@/components/CarruselTardeos";

/**
 * DJs destacados en portada. Misma tarjeta que el directorio: foto grande o
 * degradado con iniciales, nombre completo y estilos.
 */
export default function DjsDestacados({ djs }: { djs: any[] }) {
  if (!djs || djs.length === 0) return null;

  return (
    <section className="pt-10 md:pt-14">
      <CabeceraSeccion titulo="DJs destacados" subtitulo="Quién pone la música" href="/colaboradores?ver=djs" />
      <div className="no-scrollbar carousel-bleed flex gap-3 overflow-x-auto pb-3 md:gap-4">
        {djs.map((dj) => (
          <div key={dj.id} className="w-[42vw] max-w-[200px] shrink-0 sm:w-48">
            <DjCard dj={dj} />
          </div>
        ))}
      </div>
    </section>
  );
}
