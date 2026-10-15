"use client";

import { useEffect, useState } from "react";
import { CreditCard, BadgeCheck, CalendarClock, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRESTACIONES, cupoDelCiclo, type CupoCiclo } from "@/lib/cuotas";
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
  const [cupo, setCupo] = useState<{ cupo: CupoCiclo | null; falta: boolean; error: string | null } | null>(null);
  const [plazas, setPlazas] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    cupoDelCiclo(ficha.id).then((c) => vivo && setCupo(c));
    supabase.rpc("plazas_fundador").then(({ data, error }) => vivo && setPlazas(error ? null : (data as number)));
    return () => { vivo = false; };
  }, [ficha.id]);

  if (!planes) {
    return (
      <SeccionPanel titulo="Suscripción" descripcion="Planes para locales y promotores." ancho="normal">
        <div className="flex flex-col gap-4">
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
        <CupoInformativo c={cupo} />
        <TablaPlanes apagado plazas={plazas} />
        </div>
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
        <CupoInformativo c={cupo} />
        <ConsumoDelMes localId={ficha.id} plan={ficha.plan} reglasActivas={planes} />
        <TablaPlanes apagado={false} plazas={plazas} actual={plan} />
      </div>
    </SeccionPanel>
  );
}

/**
 * El cupo del ciclo, calculado en la base (lote 68). Con planes apagados es
 * solo informativo: no bloquea a nadie.
 */
function CupoInformativo({ c }: { c: { cupo: CupoCiclo | null; falta: boolean; error: string | null } | null }) {
  if (!c) return null;
  if (c.falta) return <p className="rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta-suave">El contador de eventos por ciclo llegará en breve (falta el lote 68).</p>;
  if (c.error || !c.cupo) return null;
  const k = c.cupo;
  const fmt = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
  return (
    <section className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
      <p className="text-lg font-bold">Eventos de este ciclo</p>
      <p className="text-[15px] text-tinta-suave">Del {fmt(k.ciclo_inicio)} al {fmt(k.ciclo_fin)}. Cada fecha publicada cuenta como un evento; editar no consume.</p>
      <p className="mt-3 text-[28px] font-bold leading-none">
        {k.usados}{k.incluidos != null ? <span className="text-[17px] font-semibold text-tinta-suave"> de {k.incluidos + k.extra}</span> : <span className="text-[17px] font-semibold text-tinta-suave"> · sin límite</span>}
      </p>
      {!k.planes_activos && (
        <p className="mt-2 text-[15px] text-tinta-suave">Solo informativo: mientras los planes estén desactivados puedes publicar sin límite.</p>
      )}
      {k.planes_activos && k.restantes === 0 && (
        <p className="mt-2 text-[15px] font-semibold text-aviso">Has usado tu cupo. Puedes guardar borradores o añadir un evento con 1 Coin.</p>
      )}
    </section>
  );
}

/** Los tres planes + Fundador (dossier pág. 12). Sin botón de pago. */
function TablaPlanes({ apagado, plazas, actual }: { apagado: boolean; plazas: number | null; actual?: Plan }) {
  const planes: Plan[] = ["basic", "pro", "premium", "fundador"];
  return (
    <section aria-label="Planes" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {planes.map((p) => {
        const x = PRESTACIONES[p];
        return (
          <article key={p} className={`flex flex-col rounded-2xl border bg-white p-5 shadow-tarjeta ${actual === p ? "border-magenta" : "border-linea"}`}>
            <p className="flex items-center gap-2 text-lg font-bold">
              {p === "fundador" && <Crown size={18} className="text-oro" aria-hidden />} {ETIQUETA[p]}
            </p>
            <p className="mt-1 text-[15px] font-semibold">{precioTexto(p)}</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-[15px] text-tinta-suave">
              <li>{x.eventos}</li><li>{x.promos}</li><li>{x.estadisticas}</li><li>{x.coins}</li>
              {p === "fundador" && <li>Primeros 50 locales{plazas != null ? ` (quedan ${plazas})` : ""}. Sello Fundador mientras siga activo.</li>}
            </ul>
            <div className="mt-auto pt-4">
              {apagado ? <Etiqueta>Desactivado · próximamente</Etiqueta>
                : actual === p ? <Etiqueta tono="ok">Tu plan</Etiqueta> : <Etiqueta>Escríbenos para cambiar</Etiqueta>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
