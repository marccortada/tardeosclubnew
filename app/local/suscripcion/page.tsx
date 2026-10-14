"use client";

import { CreditCard, BadgeCheck, CalendarClock } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Etiqueta } from "@/components/ui/Chip";
import ConsumoDelMes from "@/components/ConsumoDelMes";
import { useFicha } from "../_panel/PanelLocal";
import { ETIQUETA, precioTexto, diasRestantes, type Plan } from "@/lib/planes";
import { etiquetaSuscripcion } from "@/lib/estados";

/**
 * La suscripción, solo para informar. NO hay ningún botón de pago.
 *
 * Mientras `planes_activos` esté apagado se enseña la sección con un
 * «Desactivado · próximamente» claro: antes el panel ponía «Plan Fundador ·
 * activa» escrito a pelo, igual para todos, cuando ninguno de los 69 locales
 * paga nada. Un panel que le dice a un local que tiene el plan más caro
 * contratado es peor que no tener panel.
 */
export default function Suscripcion() {
  const { ficha, planes } = useFicha();

  if (!planes) {
    return (
      <SeccionPanel titulo="Suscripción" descripcion="Planes para locales y promotores." ancho="estrecho">
        <section className="rounded-2xl border border-linea bg-white p-6 shadow-tarjeta">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-marfil-100 text-tinta-suave"><CreditCard size={24} aria-hidden /></span>
            <div>
              <p className="text-lg font-bold">Suscripciones</p>
              <Etiqueta>Desactivado · próximamente</Etiqueta>
            </div>
          </div>
          <p className="mt-4 text-[15px] text-tinta">
            Ahora mismo publicar en TardeosClub <b>no cuesta nada</b>: puedes crear todos los tardeos
            que quieras.
          </p>
          <p className="mt-2 text-[15px] text-tinta-suave">
            Cuando lleguen los planes te avisaremos antes, con precios y condiciones por escrito.
            Nunca se cobra nada sin que lo aceptes tú.
          </p>
        </section>
      </SeccionPanel>
    );
  }

  // Con los planes encendidos: lo que tiene, sin acciones de pago aquí.
  const plan = (ficha.plan ?? "basic") as Plan;
  const dias = diasRestantes(ficha.plan_hasta);
  return (
    <SeccionPanel titulo="Suscripción" descripcion="Tu plan y lo que llevas consumido este mes." ancho="estrecho">
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-linea bg-white p-6 shadow-tarjeta">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-magenta-50 text-magenta"><BadgeCheck size={24} aria-hidden /></span>
            <div>
              {/* La misma redacción que en el panel del admin: se lee de
                  `lib/estados.ts` en vez de escribirla otra vez aquí. */}
              <p className="text-lg font-bold">Plan {ETIQUETA[plan]}</p>
              <p className="text-[15px] text-tinta-suave">{etiquetaSuscripcion(ficha.plan_estado)}</p>
            </div>
          </div>
          {/* Cuánto y CADA CUÁNTO: un importe sin periodo no dice lo que cuesta. */}
          <p className="mt-4 text-[15px] font-semibold">{precioTexto(plan)}</p>
          {/* La caducidad solo cuando importa: a dos meses vista es ruido. */}
          {dias !== null && dias < 0 && (
            <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-error">
              <CalendarClock size={18} aria-hidden /> Caducó hace {Math.abs(dias)} {Math.abs(dias) === 1 ? "día" : "días"}.
            </p>
          )}
          {dias !== null && dias >= 0 && dias <= 14 && (
            <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-aviso">
              <CalendarClock size={18} aria-hidden /> {dias === 0 ? "Vence hoy." : `Vence en ${dias} ${dias === 1 ? "día" : "días"}.`}
            </p>
          )}
          <p className="mt-4 text-sm text-tinta-suave">Para cambiar de plan o renovarlo, escríbenos: desde la web no se cobra nada.</p>
        </section>
        <ConsumoDelMes localId={ficha.id} plan={ficha.plan} reglasActivas={planes} />
      </div>
    </SeccionPanel>
  );
}
