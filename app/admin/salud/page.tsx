"use client";

import { useCallback, useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { revisarSalud, type Prueba } from "@/lib/salud";
import { ultimosFallos, traza } from "@/lib/registro";
import { Check, AlertTriangle, Loader2, RefreshCw, Stethoscope } from "lucide-react";

/**
 * Si algo está mal, aquí se ve. Y se ve QUÉ.
 *
 * El fallo que más veces se ha repetido en este proyecto no revienta nada: es
 * un lote de SQL sin pegar. La pantalla afectada se esconde sola —está escrita
 * para eso— y el problema se descubre semanas después mirando otra cosa. Esta
 * pantalla convierte «algo va raro» en «falta pegar el lote 41».
 */
export default function AdminSalud() {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [cargando, setCargando] = useState(true);

  const revisar = useCallback(async () => {
    setCargando(true);
    const { pruebas } = await revisarSalud();
    setPruebas(pruebas);
    setCargando(false);
  }, []);
  useEffect(() => { revisar(); }, [revisar]);

  const mal = pruebas.filter((p) => !p.ok);
  const fallos = ultimosFallos();

  return (
    <main className="pb-16">
      <PanelHeader titulo="Salud" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-tinta/60">
            {cargando ? "Revisando…" : mal.length === 0
              ? "Todo correcto."
              : `${mal.length} ${mal.length === 1 ? "cosa" : "cosas"} que mirar.`}
          </p>
          <button onClick={revisar} disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-black text-magenta ring-1 ring-magenta-100 disabled:opacity-40">
            <RefreshCw size={15} className={cargando ? "animate-spin" : ""} /> Volver a mirar
          </button>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50">
            <Loader2 className="animate-spin" /> Comprobando cada pieza…
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Lo que está mal, primero. Una lista donde hay que buscar el rojo
                entre veinte verdes no la mira nadie dos veces. */}
            {[...pruebas].sort((a, b) => Number(a.ok) - Number(b.ok)).map((p) => (
              <div key={p.nombre}
                className={`flex items-start gap-3 rounded-2xl p-4 ring-1 ${
                  p.ok ? "bg-white ring-black/5" : "bg-amber-50 ring-amber-200"}`}>
                {p.ok
                  ? <Check size={18} className="mt-0.5 shrink-0 text-green-600" />
                  : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />}
                <div className="min-w-0 flex-1">
                  <p className="font-black leading-tight">{p.nombre}</p>
                  <p className="text-sm font-semibold text-tinta/60">{p.detalle}</p>
                  {p.arreglo && (
                    <p className="mt-1 text-sm font-black text-amber-900">{p.arreglo}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Los fallos de esta sesión. No es un registro de verdad —eso vive en
            el servidor y se ve con `pm2 logs`— pero enseña lo que ha pasado
            mientras esta pestaña estaba abierta, que es lo que hace falta para
            reproducir algo que acaba de fallar. */}
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-black">
            <Stethoscope size={18} className="text-magenta" /> Fallos en esta pestaña
          </h2>
          {fallos.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm font-bold text-tinta/50 ring-1 ring-black/5">
              Ninguno desde que abriste la página.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {fallos.map((f, i) => (
                <li key={i} className="rounded-xl bg-white p-3 text-sm font-semibold ring-1 ring-black/5">
                  <span className="font-black text-magenta">{f.area}</span>{" "}
                  <span className="text-tinta/50">{new Date(f.cuando).toLocaleTimeString("es-ES")}</span>
                  <span className="block text-tinta/75">{f.mensaje}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs font-semibold text-tinta/45">
            Marca de esta sesión: <b>{traza()}</b>. Cítala si nos pides que miremos algo.
          </p>
        </section>
      </div>
    </main>
  );
}
