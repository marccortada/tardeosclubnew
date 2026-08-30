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
 * Los datos salen de `metricas_local` (lote 34), que agrupa por día y solo
 * responde al dueño o a un admin: las métricas de un local son suyas.
 */
export default function EstadisticasLocal({ localId }: { localId: string }) {
  const [dias, setDias] = useState<(typeof DIAS)[number]>(30);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinTabla, setSinTabla] = useState(false);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    const desde = new Date(); desde.setDate(desde.getDate() - dias);
    supabase
      .rpc("metricas_local", { p_local: localId, p_desde: desde.toISOString(), p_hasta: new Date().toISOString() })
      .then(({ data, error }) => {
        if (cancel) return;
        // 42883/PGRST202 = la función aún no existe (lote 34 sin pegar).
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
          {ctr !== null && clics > 0 && (
            <p className="mt-2 text-sm font-semibold text-tinta/60">
              De cada 100 personas que te miran, <b className="text-magenta">{ctr}</b> pulsan para comprar.
            </p>
          )}
        </>
      )}
    </section>
  );
}
