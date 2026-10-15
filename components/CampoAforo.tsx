"use client";

import Campo, { claseCampo } from "@/components/ui/Campo";

/**
 * Plazas de un tardeo gratis (el botón «Asistiré»). Vacío = sin límite.
 * Lleno el aforo, quien pulsa «Asistiré» entra en lista de espera (lote 64).
 * Solo tiene sentido con apuntarse dentro de TardeosClub, por eso el formulario
 * lo enseña únicamente cuando la entrada es gratis.
 */
export default function CampoAforo({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <Campo
      etiqueta="Plazas disponibles (opcional)"
      ayuda="La gente reserva con «Asistiré». Cuando se llenen, los siguientes entran en lista de espera y suben solos si alguien se borra. Vacío = sin límite."
      htmlFor="aforo"
    >
      <input
        id="aforo"
        inputMode="numeric"
        pattern="[0-9]*"
        value={valor}
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, "").slice(0, 5))}
        placeholder="Ej. 80"
        className={claseCampo}
      />
    </Campo>
  );
}
