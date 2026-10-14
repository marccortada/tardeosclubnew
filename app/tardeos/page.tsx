import ListaTardeos from "@/components/ListaTardeos";
import { getTardeosPublicados, getTardeosMasAdelante } from "@/lib/tardeos";
import RegistrarPantalla from "@/components/RegistrarPantalla";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";

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
 *
 * «Más adelante» va aparte: la ventana de 30 días sigue mandando en el
 * listado, pero un mes flojo no puede dejar la página vacía teniendo fiestas
 * ya anunciadas.
 */
export default async function Tardeos() {
  const [tardeos, masAdelante] = await Promise.all([getTardeosPublicados(), getTardeosMasAdelante(24)]);
  return (
    <>
      <RegistrarPantalla pantalla="listado" />
      {/* En escritorio la cabecera es SiteNav; en el móvil, la de la portada. */}
      <div className="md:hidden">
        <TopBar />
      </div>
      <ListaTardeos todos={tardeos} masAdelante={masAdelante} />
      <Footer />
    </>
  );
}
