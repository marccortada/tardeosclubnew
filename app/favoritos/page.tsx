import { redirect } from "next/navigation";

/** "Mis planes" pasa a Próxima Parada (v2). */
export default function Favoritos() {
  redirect("/proxima-parada");
}
