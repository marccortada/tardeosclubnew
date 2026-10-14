import { redirect } from "next/navigation";

/**
 * "Más" era el cajón de sastre del admin cuando la navegación era una barra
 * inferior de cuatro botones. Ahora la barra lateral ya enseña todas las
 * secciones, así que esta ruta solo existe para no romper enlaces guardados.
 */
export default function Mas() {
  redirect("/admin");
}
