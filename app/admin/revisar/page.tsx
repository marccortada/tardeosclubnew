"use client";

import { useEffect, useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import FilaAviso from "@/components/admin/FilaAviso";
import LocalesPorVerificar from "@/components/admin/LocalesPorVerificar";
import { leerContadores, type Contadores } from "@/lib/adminContadores";
import { BadgeCheck, Flag, MessageSquareWarning, ShieldAlert } from "lucide-react";

/**
 * Bandeja única "Por revisar": todo lo que pide una decisión del admin.
 * Las fichas por verificar se resuelven aquí mismo; reclamaciones, reseñas y
 * flyers tienen su propia pantalla (necesitan más contexto para decidir).
 */
export default function Revisar() {
  const [c, setC] = useState<Contadores | null>(null);
  const refrescar = () => { leerContadores().then(setC).catch(() => setC(null)); };
  useEffect(refrescar, []);

  return (
    <SeccionPanel
      titulo="Por revisar"
      descripcion="Lo que espera una decisión tuya. Cuando todo esté a cero, has terminado."
    >
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        <FilaAviso href="#locales" icono={<BadgeCheck size={22} aria-hidden />} titulo="Locales por verificar"
          sub="Altas nuevas sin publicar" valor={c?.localesPorVerificar ?? null} />
        <FilaAviso href="/admin/reclamaciones" icono={<Flag size={22} aria-hidden />} titulo="Reclamaciones"
          sub="Quién pide gestionar su ficha" valor={c?.reclamaciones ?? null} />
        <FilaAviso href="/admin/moderacion" icono={<MessageSquareWarning size={22} aria-hidden />} titulo="Reseñas por moderar"
          sub="Las apeladas, primero" valor={c?.resenas ?? null} />
        <FilaAviso href="/admin/moderacion?tab=flyers" icono={<ShieldAlert size={22} aria-hidden />} titulo="Flyers denunciados"
          sub="Avisos de la gente sobre un flyer" valor={c?.flyers ?? null} />
      </div>

      <section id="locales" aria-labelledby="titulo-locales" className="scroll-mt-20">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="titulo-locales" className="text-xl font-bold">
            Locales por verificar{c?.localesPorVerificar != null ? ` (${c.localesPorVerificar})` : ""}
          </h2>
        </div>
        <p className="mb-4 text-[15px] text-tinta-suave">
          Aprobar publica la ficha y le da la insignia de verificado. Rechazar la borra.
        </p>
        <LocalesPorVerificar alCambiar={refrescar} />
      </section>
    </SeccionPanel>
  );
}
