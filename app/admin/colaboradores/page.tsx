import { redirect } from "next/navigation";

/**
 * Colaboradores se separó otra vez en Locales, Promotores y DJs: con barra
 * lateral cada uno tiene su entrada y su lista paginada. Se deja la ruta
 * redirigiendo por los marcadores y enlaces antiguos.
 */
export default function Redirigir() {
  redirect("/admin/locales");
}
