import { redirect } from "next/navigation";

/**
 * "Mis gustos" (v1) lo sustituye Mi ADN (v2, dossier pág. 4 y 9): una sola
 * pantalla para lo que te mueve. Se redirige para no romper enlaces viejos
 * (correos, favoritos del navegador).
 */
export default function Redirigir() {
  redirect("/perfil/adn");
}
