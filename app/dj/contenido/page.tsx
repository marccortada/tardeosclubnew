"use client";

import { SeccionPanel } from "@/components/panel/PanelShell";
import ContenidoDj from "@/components/ContenidoDj";
import { useDj } from "../contexto";

/** Sesiones, vídeos, flyers y fotos del DJ (§5.2 del documento). */
export default function ContenidoPagina() {
  const { dj } = useDj();
  return (
    <SeccionPanel
      titulo="Sesiones y fotos"
      descripcion="Lo que se ve en tu ficha: tus mixes, vídeos, flyers y fotos de cabina."
      ancho="estrecho"
    >
      <ContenidoDj djId={dj.id} />
    </SeccionPanel>
  );
}
