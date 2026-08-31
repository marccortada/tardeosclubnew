"use client";

import { FAMILIAS } from "@/lib/musica";
import { TIPOS_EVENTO, PUBLICOS } from "@/lib/adn";
import { ZONAS } from "@/lib/zonas";
import { Users, MapPin, Music, CalendarDays } from "lucide-react";

export type Segmento = {
  musica: string[];
  tiposEvento: string[];
  edades: string[];
  zonas: string[];
};

export const SIN_SEGMENTAR: Segmento = { musica: [], tiposEvento: [], edades: [], zonas: [] };

export const haySegmento = (s: Segmento) =>
  s.musica.length + s.tiposEvento.length + s.edades.length + s.zonas.length > 0;

/**
 * A quién va dirigido un aviso.
 *
 * Existe porque "enviar a todos" gasta la lista: un tardeo de Mataró no le
 * interesa a alguien de Girona, y quien recibe tres avisos que no van con él
 * desactiva el cuarto. Un aviso sin segmentar no llega a más gente útil, llega
 * a más gente a la que molesta.
 *
 * Se piden solo cuatro criterios —música, tipo, edad y zona— y no los siete del
 * ADN, porque son los que de verdad separan a quién le interesa un plan. Los
 * criterios puestos se exigen TODOS: "remember EN el Maresme" es la
 * intersección, no la suma.
 *
 * Por música se pregunta por FAMILIA y no por estilo concreto: quien manda un
 * aviso piensa en "los de electrónica", no en "los de tech house", y ofrecer
 * ochenta estilos convierte una decisión de diez segundos en un formulario.
 */
export default function SelectorSegmento({
  valor,
  onCambio,
}: {
  valor: Segmento;
  /**
   * Recibe una FUNCIÓN, no el valor nuevo, para poder pasarle `setEstado` tal
   * cual desde el padre.
   *
   * No es purismo: construyendo el objeto aquí a partir de `valor`, dos clics
   * en el mismo instante leen los dos el mismo `valor` de props y el primero se
   * pierde. Se vio marcando zona y música a la vez desde una prueba: solo
   * quedaba la música. Un dedo humano no va tan rápido, pero el fallo estaba.
   */
  onCambio: (actualizar: (previo: Segmento) => Segmento) => void;
}) {
  const alternar = (campo: keyof Segmento, v: string) =>
    onCambio((previo) => ({
      ...previo,
      [campo]: previo[campo].includes(v)
        ? previo[campo].filter((x) => x !== v)
        : [...previo[campo], v],
    }));

  const grupos = [
    { campo: "zonas" as const, icono: MapPin, label: "Zona", opciones: ZONAS.map((z) => ({ k: z, t: z })) },
    { campo: "musica" as const, icono: Music, label: "Música", opciones: FAMILIAS.map((f) => ({ k: f.id, t: f.nombre })) },
    { campo: "tiposEvento" as const, icono: CalendarDays, label: "Tipo de plan", opciones: TIPOS_EVENTO.map((t) => ({ k: t, t })) },
    { campo: "edades" as const, icono: Users, label: "Edad", opciones: PUBLICOS.map((p) => ({ k: p, t: p })) },
  ];

  return (
    <div className="flex flex-col gap-3">
      {grupos.map((g) => (
        <div key={g.campo}>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
            <g.icono size={15} className="text-magenta" /> {g.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {g.opciones.map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => alternar(g.campo, o.k)}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                  valor[g.campo].includes(o.k)
                    ? "bg-marca text-white"
                    : "bg-black/5 text-tinta/50 hover:bg-black/10"
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
