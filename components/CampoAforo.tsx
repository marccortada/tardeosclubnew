"use client";

import Campo, { claseCampo } from "@/components/ui/Campo";

/**
 * Plazas de un tardeo gratis (el botón "Apuntarme"). Vacío = sin límite.
 * Solo tiene sentido con apuntarse dentro de TardeosClub, por eso el formulario
 * lo enseña únicamente cuando la entrada es gratis.
 */
export default function CampoAforo({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <Campo
      etiqueta="Plazas disponibles (opcional)"
      ayuda="Cuando se llenen, el botón «Apuntarme» pasa a «Completo». Déjalo vacío si no hay límite."
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
