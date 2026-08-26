import { tamanoDeAforo } from "@/lib/adn";
import { Users, Shirt, Sparkles, Store, Music, LayoutGrid, Clock } from "lucide-react";

/**
 * El ADN del local en su ficha pública.
 *
 * Solo se pinta lo que esté puesto. Los 66 locales llegaron de la app vieja sin
 * nada de esto, así que una parrilla con ocho apartados vacíos haría parecer
 * que a la ficha le falta media pantalla.
 */
export default function AdnLocalFicha({ local }: { local: any }) {
  const tamano = tamanoDeAforo(local.aforo);

  const filas: { icono: typeof Store; etiqueta: string; valores: string[] }[] = [
    { icono: Store, etiqueta: "Tipo de sitio", valores: local.tipo_local ? [local.tipo_local] : [] },
    {
      icono: Users,
      etiqueta: "Aforo",
      // El número y el tamaño juntos: "250" solo no dice mucho a quien no
      // conoce salas, y "Mediano" solo se queda corto para quien sí.
      valores: local.aforo ? [`${local.aforo} personas${tamano ? ` · ${tamano}` : ""}`] : [],
    },
    { icono: LayoutGrid, etiqueta: "Espacios", valores: local.espacios ?? [] },
    { icono: Music, etiqueta: "Música habitual", valores: local.musica ?? [] },
    { icono: Sparkles, etiqueta: "Ambiente", valores: local.ambiente ?? [] },
    { icono: Users, etiqueta: "Público", valores: local.publico ?? [] },
    { icono: Shirt, etiqueta: "Cómo se viene", valores: local.dress_code ? [local.dress_code] : [] },
    { icono: Clock, etiqueta: "Horario", valores: local.horario_habitual ? [local.horario_habitual] : [] },
  ].filter((f) => f.valores.length > 0);

  if (filas.length === 0) return null;

  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-black md:text-2xl">
        <Sparkles size={22} className="text-magenta" /> Cómo es este sitio
      </h2>
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
        {filas.map(({ icono: Icono, etiqueta, valores }) => (
          <div key={etiqueta} className="flex items-start gap-3">
            <Icono size={17} className="mt-1 shrink-0 text-magenta" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-tinta/45">{etiqueta}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {valores.map((v) => (
                  <span key={v} className="rounded-full bg-magenta-50 px-3 py-1 text-sm font-extrabold text-magenta-700">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
