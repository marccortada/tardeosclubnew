"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getMetricasPorTardeo, type MetricaTardeo } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import { Eye, MousePointerClick, Ticket, Heart, Loader2, TrendingUp, ListOrdered } from "lucide-react";

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
export default function EstadisticasLocal({ localId, enlace = (r: string) => r }: { localId: string; enlace?: (r: string) => string }) {
  const [dias, setDias] = useState<(typeof DIAS)[number]>(30);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinTabla, setSinTabla] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [porTardeo, setPorTardeo] = useState<{ filas: MetricaTardeo[]; error: string | null; aproximado: boolean } | null>(null);

  // Por tardeo: cuál de ellos funciona. Con el mismo periodo que arriba.
  useEffect(() => {
    let vivo = true;
    setPorTardeo(null);
    getMetricasPorTardeo(localId, dias).then((r) => vivo && setPorTardeo(r));
    return () => { vivo = false; };
  }, [localId, dias]);

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
        if (error) {
          const falta = error.code === "42883" || error.code === "PGRST202";
          setSinTabla(falta);
          // Un fallo de verdad se enseña: si no, el panel dice «sin movimiento»
          // y el local se lo cree.
          setError(falta ? null : error.message);
        } else setError(null);
        setFilas((data as Fila[]) ?? []);
        setCargando(false);
      });
    return () => { cancel = true; };
  }, [localId, dias]);

  if (sinTabla) {
    return (
      <section>
        <p className="rounded-2xl border border-aviso/25 bg-aviso-fondo p-4 text-[15px] text-tinta">
          Las estadísticas por días aún no están activas: falta pegar el lote 39
          (supabase/39_ventana_metricas_local.sql).
        </p>
        <TablaPorTardeo datos={porTardeo} dias={dias} enlace={enlace} />
      </section>
    );
  }

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
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <TrendingUp size={20} className="text-magenta" aria-hidden /> Cómo va
        </h2>
        <div className="flex gap-1.5" role="group" aria-label="Periodo">
          {DIAS.map((d) => (
            <button key={d} onClick={() => setDias(d)} aria-pressed={dias === d}
              className={`min-h-[44px] rounded-xl border px-3.5 text-[15px] font-semibold transition ${
                dias === d ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta hover:bg-marfil-100"}`}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl border border-error/20 bg-error-fondo p-4 text-[15px] font-semibold text-error">
          No se pudieron cargar las estadísticas: {error}
        </p>
      ) : cargando ? (
        <div className="flex items-center gap-2 rounded-2xl border border-linea bg-white p-5 text-[15px] text-tinta-suave">
          <Loader2 size={18} className="animate-spin" aria-hidden /> Cargando…
        </div>
      ) : !hayAlgo ? (
        <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center text-[15px] text-tinta-suave">
          Todavía no hay movimiento en estos {dias} días. Se empieza a contar desde que alguien
          entra a ver tus tardeos.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tarjetas.map(({ icon: Icono, label, valor }) => (
              <div key={label} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
                <Icono size={20} className="text-magenta" aria-hidden />
                <p className="mt-2 text-[28px] font-bold leading-none">{valor.toLocaleString("es-ES")}</p>
                <p className="mt-1.5 text-[15px] font-semibold text-tinta-suave">{label}</p>
              </div>
            ))}
          </div>
          {ctr !== null && (
            <p className="mt-3 rounded-xl bg-white p-4 text-[15px] text-tinta-suave ring-1 ring-linea">
              De cada 100 personas que te miran, <b className="text-magenta-700">{ctr}</b>{" "}
              {ctr === 1 ? "pulsa" : "pulsan"} para comprar.
              {clics === 0 && (
                <> Nadie ha pulsado todavía en estos {dias} días: mira si el enlace de entradas está puesto.</>
              )}
            </p>
          )}
        </>
      )}

      <TablaPorTardeo datos={porTardeo} dias={dias} enlace={enlace} />
    </section>
  );
}

/**
 * Tardeo a tardeo: visitas, clics a comprar y guardados en el periodo. Los
 * diez con más visitas; el resto no cabe en un móvil y no decide nada.
 */
function TablaPorTardeo({ datos, dias, enlace }: {
  datos: { filas: MetricaTardeo[]; error: string | null; aproximado: boolean } | null;
  dias: number; enlace: (r: string) => string;
}) {
  const [todos, setTodos] = useState(false);
  const filas = datos?.filas ?? [];
  const visibles = todos ? filas : filas.slice(0, 10);
  return (
    <div className="mt-6">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <ListOrdered size={18} className="text-magenta" aria-hidden /> Por tardeo
      </h3>
      {!datos ? (
        <div className="flex items-center gap-2 rounded-2xl border border-linea bg-white p-5 text-[15px] text-tinta-suave">
          <Loader2 size={18} className="animate-spin" aria-hidden /> Cargando…
        </div>
      ) : datos.error ? (
        <p role="alert" className="rounded-2xl border border-error/20 bg-error-fondo p-4 text-[15px] font-semibold text-error">
          No se pudieron cargar las cifras por tardeo: {datos.error}
        </p>
      ) : filas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center text-[15px] text-tinta-suave">
          Ningún tardeo ha tenido visitas en estos {dias} días.
        </p>
      ) : (
        <>
          {datos.aproximado && (
            <p className="mb-2 text-sm text-tinta-suave">
              Cifras aproximadas (se han contado los últimos 5.000 movimientos). Para el dato exacto falta pegar
              el lote 54 (supabase/54_metricas_por_tardeo.sql).
            </p>
          )}
          <div className="overflow-hidden rounded-2xl border border-linea bg-white shadow-tarjeta">
            <div className="hidden grid-cols-[minmax(0,1fr)_90px_90px_90px] gap-2 border-b border-linea bg-marfil-100 px-4 py-2 text-[13px] font-semibold uppercase tracking-wide text-tinta-suave md:grid">
              <span>Tardeo</span><span className="text-right">Visitas</span><span className="text-right">Clics</span><span className="text-right">Guardados</span>
            </div>
            <ul>
              {visibles.map((f) => (
                <li key={f.tardeo_id} className="grid grid-cols-3 gap-2 border-b border-linea px-4 py-3 last:border-0 md:grid-cols-[minmax(0,1fr)_90px_90px_90px] md:items-center">
                  <Link href={enlace(`/local/tardeos/${f.tardeo_id}/editar`)} className="col-span-3 min-w-0 md:col-span-1">
                    <span className="block text-sm font-semibold text-tinta-suave">{f.fecha ? formatFecha(f.fecha) : ""}</span>
                    <span className="block truncate text-[16px] font-bold hover:text-magenta-700">{f.titulo}</span>
                  </Link>
                  {([["Visitas", f.visitas], ["Clics", f.clics], ["Guardados", f.guardados]] as const).map(([l, v]) => (
                    <span key={l} className="text-[15px] md:text-right">
                      <b className="text-[17px]">{v.toLocaleString("es-ES")}</b>
                      <span className="ml-1 text-tinta-suave md:hidden">{l.toLowerCase()}</span>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
          {filas.length > 10 && (
            <button type="button" onClick={() => setTodos((v) => !v)}
              className="mt-2 inline-flex min-h-[44px] items-center text-[15px] font-bold text-magenta-700">
              {todos ? "Ver solo los 10 primeros" : `Ver los ${filas.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
