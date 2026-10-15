"use client";

import Link from "next/link";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Enviar } from "@/app/nexo/NexoRadioPagina";

/**
 * Enviar sesión a Nexo desde el panel del DJ: el mismo formulario y la misma
 * lista de envíos (con su estado) que la pestaña "Enviar sesión" de /nexo.
 */
export default function NexoDj() {
  return (
    <SeccionPanel titulo="Enviar sesión a Nexo" descripcion="El equipo de Nexo Radio revisa cada envío. Enviar no garantiza emisión ni fecha." ancho="estrecho">
      <Enviar />
      <Link href="/nexo" className="mt-6 inline-flex min-h-tacto items-center font-bold text-magenta">Ir a Nexo Radio en la app</Link>
    </SeccionPanel>
  );
}
