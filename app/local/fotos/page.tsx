"use client";

import { SeccionPanel } from "@/components/panel/PanelShell";
import GestionFotosLocal from "@/components/GestionFotosLocal";
import { useFicha } from "../_panel/PanelLocal";

/** Fotos del local: se suben, se ordenan (portada) y se quitan aquí. */
export default function Fotos() {
  const { ficha, actualizar, esPromotor } = useFicha();
  return (
    <SeccionPanel
      titulo="Fotos"
      descripcion={esPromotor
        ? "Fotos de tus eventos. La primera es la portada de tu página pública."
        : "Fotos de tu local. La primera es la portada de tu página pública."}
    >
      {/* key: al cambiar de ficha se monta de nuevo con las fotos de la otra. */}
      <GestionFotosLocal
        key={ficha.id}
        localId={ficha.id}
        iniciales={Array.isArray(ficha.fotos) ? ficha.fotos : []}
        onCambio={(fotos) => actualizar({ fotos })}
      />
    </SeccionPanel>
  );
}
