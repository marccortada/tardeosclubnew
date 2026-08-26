import ListaTardeos from "@/components/ListaTardeos";
import { getTardeosPublicados } from "@/lib/tardeos";

// Mismo minuto que la portada: un tardeo recién publicado tarda como mucho eso
// en asomar por aquí.
// Se pinta en cada visita, no por ISR: ver el porqué en app/page.tsx.
export const dynamic = "force-dynamic";

/**
 * El listado. La consulta se hace en el servidor y los filtros siguen en el
 * cliente.
 *
 * Antes la página entera era de cliente y pedía los tardeos al montarse: su
 * HTML salía con el título, los filtros y un "Cargando tardeos…", sin una sola
 * ficha. Google indexaba una página vacía justo en la que más debería traer
 * gente, y quien entraba veía un spinner antes que el contenido.
 */
export default async function Tardeos() {
  const tardeos = await getTardeosPublicados();
  return <ListaTardeos todos={tardeos} />;
}
