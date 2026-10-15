import EventosCliente from "./EventosCliente";
import RegistrarPantalla from "@/components/RegistrarPantalla";
import { getTardeosPublicados, getTardeosMasAdelante } from "@/lib/tardeos";
import { metadataPublica } from "@/lib/seo";

// Se pinta en cada visita (ver el porqué en app/page.tsx).
export const dynamic = "force-dynamic";

export const metadata = metadataPublica(
  "Eventos y tardeos · TardeosClub",
  "Tardeos de hoy, mañana y este finde en mapa, lista o calendario. Filtra por zona, música, tipo de plan y precio.",
  "/eventos"
);

/** Eventos (dossier pág. 4): Mapa · Lista · Mes en una sola pantalla. */
export default async function Eventos() {
  // También los anunciados más allá del mes: la vista Mes deja ir al siguiente.
  const [delMes, masAdelante] = await Promise.all([getTardeosPublicados(), getTardeosMasAdelante(60)]);
  return (
    <>
      <RegistrarPantalla pantalla="listado" />
      <EventosCliente todos={[...delMes, ...masAdelante]} />
    </>
  );
}
