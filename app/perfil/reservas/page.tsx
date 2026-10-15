import { redirect } from "next/navigation";

/** "Mis reservas" (v1) son ahora los planes de Próxima Parada (v2). Directo, sin pasar por /favoritos. */
export default function Redirigir() {
  redirect("/proxima-parada");
}
