import { redirect } from "next/navigation";

/**
 * El directorio de DJs se fundió con el de locales y promotores en
 * /colaboradores. Esta ruta se queda como redirección porque /djs puede estar
 * compartido por WhatsApp o enlazado desde fuera, y romperlo no aporta nada.
 *
 * Las fichas individuales (/djs/[id]) siguen donde estaban.
 */
export default function DjsRedirect() {
  redirect("/colaboradores?ver=djs");
}
