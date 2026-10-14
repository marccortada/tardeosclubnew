import MapaFiltrable from "@/components/MapaFiltrable";
import { getTardeosPublicados, getTardeosMasAdelante } from "@/lib/tardeos";
import RegistrarPantalla from "@/components/RegistrarPantalla";

// Los mismos 60 s que la portada y el listado.
// Se pinta en cada visita, no por ISR: ver el porqué en app/page.tsx.
export const dynamic = "force-dynamic";

/**
 * El mapa, con los tardeos ya cargados del servidor.
 *
 * Antes esta página los pedía al montarse, y eso rompía el mapa: llegaban
 * DESPUÉS de que Leaflet se hubiera creado, el componente se remontaba, y las
 * chinchetas acababan añadidas a un mapa ya destruido. Resultado: mapa vacío
 * con el contador diciendo "2 tardeos". En la portada nunca pasó porque allí
 * los datos venían del servidor desde el primer render — que es justo lo que se
 * hace ahora aquí.
 *
 * De paso, el HTML deja de salir vacío. Mismo patrón que /tardeos.
 */
export default async function Mapa() {
  // También los ya anunciados para más allá del mes: con un mes flojo, el
  // mapa decía "0 tardeos" teniendo fiestas anunciadas para dentro de dos.
  // Los filtros de fecha (hoy, finde…) siguen quedándose con lo suyo.
  const [delMes, masAdelante] = await Promise.all([getTardeosPublicados(), getTardeosMasAdelante(24)]);
  const tardeos = [...delMes, ...masAdelante];
  return (
    <>
      <RegistrarPantalla pantalla="mapa" />
      <MapaFiltrable todos={tardeos} />
    </>
  );
}
