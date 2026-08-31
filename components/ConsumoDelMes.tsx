"use client";

import { useEffect, useState } from "react";
import { consumoDeLocal, CUOTAS, PRECIO_EXTRA, type Consumo } from "@/lib/cuotas";
import { ETIQUETA, type Plan, PLANES } from "@/lib/planes";
import { CalendarDays, Megaphone, Loader2 } from "lucide-react";

/**
 * Lo que lleva consumido el local este mes, y lo que le va a costar de más.
 *
 * Se enseña ANTES de la factura, no después. Un local que se entera a fin de
 * mes de que debe 6 € que no esperaba se enfada aunque los deba; el mismo local
 * que lo ve subir mientras publica, no. Es la diferencia entre cobrar y
 * sorprender.
 *
 * Solo se pinta si las reglas de los planes están encendidas: mientras están
 * apagadas nadie paga nada y enseñar un contador de extras sería mentir.
 */
export default function ConsumoDelMes({
  localId,
  plan,
  reglasActivas,
}: {
  localId: string;
  plan: string | null | undefined;
  reglasActivas: boolean;
}) {
  const [c, setC] = useState<Consumo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!reglasActivas) { setCargando(false); return; }
    consumoDeLocal(localId, plan).then((x) => { setC(x); setCargando(false); });
  }, [localId, plan, reglasActivas]);

  if (!reglasActivas || cargando || !c) {
    return cargando && reglasActivas ? (
      <p className="mt-4 flex items-center gap-2 text-sm font-bold text-tinta/40">
        <Loader2 size={14} className="animate-spin" /> Contando lo del mes…
      </p>
    ) : null;
  }

  const p = ((PLANES as readonly string[]).includes(plan ?? "") ? plan : "basic") as Plan;
  const cuota = CUOTAS[p];

  const filas = [
    {
      icono: CalendarDays,
      etiqueta: "Eventos este mes",
      usado: c.eventosMes,
      incluido: cuota.eventosMes,
      demas: c.eventosDeMas,
      precio: PRECIO_EXTRA.evento,
    },
    {
      icono: Megaphone,
      etiqueta: "Promociones activas",
      usado: c.promosActivas,
      incluido: cuota.promosSimultaneas,
      demas: c.promosDeMas,
      precio: PRECIO_EXTRA.promocion,
    },
  ];

  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="font-display text-lg font-black">Tu plan {ETIQUETA[p]}</p>
        {c.euros > 0 && (
          <p className="text-sm font-black text-oro-600">+{c.euros} € este mes</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {filas.map(({ icono: Icono, etiqueta, usado, incluido, demas, precio }) => (
          <div key={etiqueta} className="flex items-center gap-3">
            <Icono size={17} className="shrink-0 text-magenta" />
            <span className="min-w-0 flex-1 text-sm font-bold text-tinta/70">{etiqueta}</span>
            <span className="shrink-0 text-sm font-black">
              {usado}
              {incluido != null && <span className="font-bold text-tinta/40"> de {incluido}</span>}
              {incluido == null && <span className="font-bold text-tinta/40"> · sin límite</span>}
            </span>
            {demas > 0 && (
              <span className="shrink-0 rounded-full bg-oro/20 px-2 py-0.5 text-xs font-black text-oro-700">
                +{demas * precio} €
              </span>
            )}
          </div>
        ))}
      </div>

      {c.euros > 0 ? (
        <p className="mt-3 text-xs font-semibold text-tinta/55">
          Lo que te pasas se suma a la cuota del mes que viene. No se cobra suelto.
        </p>
      ) : (
        <p className="mt-3 text-xs font-semibold text-tinta/55">
          Todo dentro de lo incluido.
        </p>
      )}
    </section>
  );
}
