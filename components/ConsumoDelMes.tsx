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
      <p className="flex items-center gap-2 text-[15px] text-tinta-suave">
        <Loader2 size={16} className="animate-spin" aria-hidden /> Contando lo del mes…
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
    <section className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-lg font-bold">Tu plan {ETIQUETA[p]}</p>
        {c.euros > 0 && (
          <p className="text-[15px] font-bold text-aviso">+{c.euros} € este mes</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {filas.map(({ icono: Icono, etiqueta, usado, incluido, demas, precio }) => (
          <div key={etiqueta} className="flex items-center gap-3">
            <Icono size={18} className="shrink-0 text-magenta" aria-hidden />
            <span className="min-w-0 flex-1 text-[15px] text-tinta-suave">{etiqueta}</span>
            <span className="shrink-0 text-[15px] font-bold">
              {usado}
              {incluido != null && <span className="font-medium text-tinta-suave"> de {incluido}</span>}
              {incluido == null && <span className="font-medium text-tinta-suave"> · sin límite</span>}
            </span>
            {demas > 0 && (
              <span className="shrink-0 rounded-full bg-aviso-fondo px-2 py-0.5 text-[13px] font-semibold text-aviso">
                +{demas * precio} €
              </span>
            )}
          </div>
        ))}
      </div>

      {c.euros > 0 ? (
        <p className="mt-3 text-sm text-tinta-suave">
          Lo que te pasas se suma a la cuota del mes que viene. No se cobra suelto.
        </p>
      ) : (
        <p className="mt-3 text-sm text-tinta-suave">
          Todo dentro de lo incluido.
        </p>
      )}
    </section>
  );
}
