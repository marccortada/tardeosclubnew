import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { invalidarCacheTardeos, invalidarCacheListas } from "@/lib/tardeos";
import { invalidarAjustes } from "@/lib/ajustes";
import { autorizarAdmin, secretoCronValido } from "@/lib/apiAuth";

export const runtime = "nodejs";

/**
 * Rehace las páginas públicas a la fuerza.
 *
 * Existe porque la regeneración de fondo de Next se atascó: el 20 de agosto la
 * portada, /tardeos y /mapa estuvieron OCHO HORAS enseñando 17 tardeos cuando
 * la base ya tenía 33. Las páginas respondían `x-nextjs-cache: STALE` una
 * petición tras otra sin rehacerse nunca, y solo se arreglaron al reiniciar el
 * proceso. No conseguí dar con el mecanismo exacto del atasco.
 *
 * Así que el refresco deja de depender de que eso funcione. Quien escribe los
 * datos —la sincronización de cada mañana— avisa aquí al terminar, y las
 * páginas se rehacen en ese momento. Si además la regeneración de fondo va
 * bien, no molesta: rehacer una página que ya estaba al día no cuesta nada.
 *
 * Solo POST. Se protege con el mismo secreto que /api/recordatorios, SOLO por
 * cabecera `x-cron-secret` (o sesión de admin).
 */
const RUTAS = ["/", "/tardeos", "/mapa", "/colaboradores"];

async function handler(req: Request) {
  // Dos formas de entrar: el secreto (lo usa la sincronización diaria) o una
  // sesión de admin. Lo segundo es para que al marcar un destacado la portada
  // lo enseñe ya: si hay que esperar el minuto de la caché, quien lo acaba de
  // marcar va a mirar, no lo ve, y da por hecho que no funciona.
  if (!secretoCronValido(req)) {
    const cuerpo: { accessToken?: string } = await req.json().catch(() => ({}));
    const auth = await autorizarAdmin(cuerpo?.accessToken, req);
    if (auth instanceof NextResponse) return auth;
  }

  // Las cachés en memoria duran un minuto. Sin vaciarlas, la página se pinta
  // leyendo lo de hace un rato y el aviso no serviría de nada.
  invalidarCacheTardeos();
  invalidarCacheListas();
  // También los ajustes: al encender o apagar las reglas de los planes hay que
  // verlo YA, no dentro de medio minuto.
  invalidarAjustes();
  RUTAS.forEach((r) => revalidatePath(r));

  return NextResponse.json({ ok: true, rehechas: RUTAS });
}

export const POST = handler;
