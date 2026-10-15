"use client";

import { SeccionPanel } from "@/components/panel/PanelShell";
import ContenidoDj from "@/components/ContenidoDj";
import { useDj } from "../contexto";

/** Sesiones, vídeos, flyers y fotos del DJ (§5.2 del documento). */
export default function ContenidoPagina() {
  const { dj } = useDj();
  return (
    <SeccionPanel
      titulo="Fotos y flyers"
      descripcion="Flyers y fotos de cabina para tu ficha. Tus sesiones van en «Publicar set»."
      ancho="estrecho"
    >
      <ContenidoDj djId={dj.id} />
    </SeccionPanel>
  );
}
