import { redirect } from "next/navigation";

/** "Mis reservas" pasó a ser la pestaña "Me he apuntado" de Mis planes. */
export default function Redirigir() {
  redirect("/favoritos?ver=apuntados");
}
