"use client";

import { useEffect, useState } from "react";
import { Eye, Users } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import EstadisticasLocal from "@/components/EstadisticasLocal";
import ConsumoDelMes from "@/components/ConsumoDelMes";
import { useFicha } from "../_panel/PanelLocal";
import { getMetricasLocal } from "@/lib/tardeos";

/**
 * Las cifras del local: el periodo elegido (7/30/90 días, con fechas de
 * verdad) y, debajo, el acumulado de siempre como referencia.
 *
 * El consumo del plan solo sale con los planes encendidos: mientras están
 * apagados nadie paga nada y un contador de extras sería mentir.
 */
export default function Estadisticas() {
  const { ficha, planes, enlace } = useFicha();
  const [total, setTotal] = useState<{ visitas: number; inscritos: number; error: string | null } | null>(null);

  useEffect(() => {
    let vivo = true;
    getMetricasLocal(ficha.id).then((m) => vivo && setTotal(m));
    return () => { vivo = false; };
  }, [ficha.id]);

  return (
    <SeccionPanel titulo="Estadísticas" descripcion="Cuánta gente ve tus tardeos y cuántos pulsan para ir.">
      <div className="flex flex-col gap-8">
        <EstadisticasLocal localId={ficha.id} enlace={enlace} />

        <section>
          <h2 className="mb-3 text-xl font-bold">Desde que estás en TardeosClub</h2>
          {total?.error && (
            <p role="alert" className="mb-3 rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">
              No se pudieron cargar los totales: {total.error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 md:max-w-xl">
            {[
              { icon: Eye, label: "Visitas en total", valor: total?.visitas },
              { icon: Users, label: "Apuntados en total", valor: total?.inscritos },
            ].map(({ icon: Icon, label, valor }) => (
              <div key={label} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
                <Icon size={20} className="text-magenta" aria-hidden />
                <p className="mt-2 text-[28px] font-bold leading-none">
                  {total ? (total.error ? "—" : (valor ?? 0).toLocaleString("es-ES")) : <span className="inline-block h-7 w-12 animate-pulse rounded bg-marfil-100" />}
                </p>
                <p className="mt-1.5 text-[15px] font-semibold text-tinta-suave">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {planes && <ConsumoDelMes localId={ficha.id} plan={ficha.plan} reglasActivas={planes} />}
      </div>
    </SeccionPanel>
  );
}
