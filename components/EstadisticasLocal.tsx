"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Eye, MousePointerClick, Ticket, Heart, Loader2, TrendingUp } from "lucide-react";

type Fila = { dia: string; tipo: string; total: number };

const DIAS = [7, 30, 90] as const;

/**
 * Lo que ha pasado con este local, con fechas de verdad.
 *
 * Antes el panel solo enseñaba un contador acumulado de visitas: un número que
 * sube y no dice nada. No se podía comparar un mes con otro ni ver si algo va a
 * mejor, que es justo lo que un local paga por saber.
 *
 * Los datos salen de `metricas_local` (lote 34, ventana rehecha en el 39), que
 * agrupa por día y solo responde al dueño o a un admin: las métricas de un
 * local son suyas.
 */
export default function EstadisticasLocal({ localId }: { localId: string }) {
  const [dias, setDias] = useState<(typeof DIAS)[number]>(30);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinTabla, setSinTabla] = useState(false);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    /**
     * Se mandan DÍAS, no dos fechas. La ventana la calcula la base con su reloj.
     *
     * Antes se mandaba `new Date()` como tope y se perdían las filas más
     * recientes: las sella la base, cuyo reloj va por delante del navegador
     * —74 ms medidos contra el mío, minutos en un móvil desajustado—, así que
     * caían fuera de la ventana. El panel no daba error: daba de menos.
     */
    supabase
      .rpc("metricas_local", { p_local: localId, p_dias: dias })
      .then(({ data, error }) => {
        if (cancel) return;
        // 42883/PGRST202 = la función aún no existe (lote 39 sin pegar).
        if (error) setSinTabla(error.code === "42883" || error.code === "PGRST202");
        setFilas((data as Fila[]) ?? []);
        setCargando(false);
      });
    return () => { cancel = true; };
  }, [localId, dias]);

  if (sinTabla) return null;

  const suma = (tipo: string) => filas.filter((f) => f.tipo === tipo).reduce((s, f) => s + Number(f.total), 0);
  const vistas = suma("vista_tardeo") + suma("vista_local");
  const clics = suma("clic_entrada") + suma("clic_lista");
  const favoritos = suma("favorito");
  const inscripciones = suma("inscripcion");
  // Cuántos de los que miran acaban pulsando para comprar. Es EL número: sin
  // esto solo sabes que te ven, no que te sirva de algo.
  //
  // `null` SOLO cuando no hay visitas, porque entonces la división no existe.
  // Con visitas y cero clics el resultado es 0, y es un dato: significa que la
  // gente llega y no pulsa. Antes esa frase se escondía justo en ese caso
  // —se pedía `clics > 0`— y el panel quedaba mudo precisamente cuando más
  // tenía que decir.
  const ctr = vistas > 0 ? Math.round((clics / vistas) * 1000) / 10 : null;

  const tarjetas = [
    { icon: Eye, label: "Visitas", valor: vistas },
    { icon: MousePointerClick, label: "Clics a comprar", valor: clics },
    { icon: Heart, label: "Guardados", valor: favoritos },
    { icon: Ticket, label: "Apuntados", valor: inscripciones },
  ];

  const hayAlgo = vistas + clics + favoritos + inscripciones > 0;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-black">
          <TrendingUp size={20} className="text-magenta" /> Cómo va
        </h2>
        <div className="flex gap-1">
          {DIAS.map((d) => (
            <button key={d} onClick={() => setDias(d)}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-extrabold transition ${
                dias === d ? "bg-magenta text-white" : "bg-white text-tinta/60 ring-1 ring-magenta-100"}`}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 rounded-2xl bg-white p-5 text-sm font-bold text-tinta/50 ring-1 ring-black/5">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : !hayAlgo ? (
        <p className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">
          Todavía no hay movimiento en estos {dias} días. Se empieza a contar desde que alguien
          entra a ver tus tardeos.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tarjetas.map(({ icon: Icono, label, valor }) => (
              <div key={label} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <Icono size={20} className="text-magenta" />
                <p className="mt-2 font-display text-2xl font-black leading-none">{valor}</p>
                <p className="mt-1 text-xs font-bold text-tinta/60">{label}</p>
              </div>
            ))}
          </div>
          {ctr !== null && (
            <p className="mt-2 text-sm font-semibold text-tinta/60">
              De cada 100 personas que te miran, <b className="text-magenta">{ctr}</b>{" "}
              {ctr === 1 ? "pulsa" : "pulsan"} para comprar.
              {clics === 0 && (
                <> Nadie ha pulsado todavía en estos {dias} días: mira si el enlace de entradas está puesto.</>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
