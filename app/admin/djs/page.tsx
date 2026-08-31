import { redirect } from "next/navigation";

/**
 * Se fusionó con /admin/djs en /admin/colaboradores: eran la misma pantalla
 * escrita dos veces, y los promotores no tenían ninguna.
 *
 * Se deja la redirección en vez de borrar la ruta porque hay enlaces a ella
 * desde otras pantallas y desde los marcadores de quien la usaba.
 */
export default function Redirigir() {
  redirect("/admin/colaboradores");
}
