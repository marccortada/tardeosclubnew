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
    // Música y ambiente primero: es lo que decide si alguien va o no.
    { icono: Music, etiqueta: "Música habitual", valores: local.musica ?? [] },
    { icono: Sparkles, etiqueta: "Ambiente", valores: local.ambiente ?? [] },
    { icono: Users, etiqueta: "Público", valores: local.publico ?? [] },
    { icono: Store, etiqueta: "Tipo de sitio", valores: local.tipo_local ? [local.tipo_local] : [] },
    {
      icono: Users,
      etiqueta: "Aforo",
      // El número y el tamaño juntos: "250" solo no dice mucho a quien no
      // conoce salas, y "Mediano" solo se queda corto para quien sí.
      valores: local.aforo ? [`${local.aforo} personas${tamano ? ` · ${tamano}` : ""}`] : [],
    },
    { icono: LayoutGrid, etiqueta: "Espacios", valores: local.espacios ?? [] },
    { icono: Shirt, etiqueta: "Cómo se viene", valores: local.dress_code ? [local.dress_code] : [] },
    { icono: Clock, etiqueta: "Horario", valores: local.horario_habitual ? [local.horario_habitual] : [] },
  ].filter((f) => f.valores.length > 0);

  if (filas.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 font-display text-[24px] font-bold leading-tight md:text-[30px]">Música y ambiente</h2>
      <div className="grid gap-5 rounded-2xl border border-linea bg-white p-5 shadow-tarjeta sm:grid-cols-2 md:p-6">
        {filas.map(({ icono: Icono, etiqueta, valores }) => (
          <div key={etiqueta} className="flex items-start gap-3">
            <Icono size={20} className="mt-0.5 shrink-0 text-magenta" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-tinta-suave">{etiqueta}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {valores.map((v) => (
                  <span key={v} className="rounded-full bg-magenta-50 px-3 py-1 text-[14px] font-semibold text-magenta-700">
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
