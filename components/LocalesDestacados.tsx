import LocalCard from "@/components/LocalCard";
import { CabeceraSeccion } from "@/components/CarruselTardeos";

/**
 * Locales y promotores destacados en portada, en el orden que fija el admin
 * desde /admin/destacados.
 *
 * Usa la misma tarjeta que el directorio: logo sobre fondo oscuro, nombre en
 * dos líneas y tipo. Antes era una versión reducida que cortaba los nombres.
 *
 * Si no hay ninguno destacado no se pinta la sección: más vale que no exista a
 * que salga un hueco vacío entre los DJs y las zonas.
 */
export default function LocalesDestacados({
  locales,
  sonDePago = true,
}: {
  locales: any[];
  /** false = no hay ninguno destacado y se enseñan los que tienen tardeos. */
  sonDePago?: boolean;
}) {
  if (!locales || locales.length === 0) return null;

  return (
    <section className="pt-10 md:pt-14">
      <CabeceraSeccion
        titulo={sonDePago ? "Locales destacados" : "Locales con tardeos"}
        subtitulo="Dónde se hace el plan"
        href="/colaboradores"
      />
      <div className="no-scrollbar carousel-bleed flex gap-3 overflow-x-auto pb-3 md:gap-4">
        {locales.map((l) => (
          <div key={l.id} className="w-[46vw] max-w-[220px] shrink-0 sm:w-52">
            <LocalCard local={l} />
          </div>
        ))}
      </div>
    </section>
  );
}
