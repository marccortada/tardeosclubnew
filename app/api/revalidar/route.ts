import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { invalidarCacheTardeos } from "@/lib/tardeos";

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
 * Se protege con el mismo secreto que /api/recordatorios.
 */
const RUTAS = ["/", "/tardeos", "/mapa", "/colaboradores"];

function autorizado(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const url = new URL(req.url);
  const dado = req.headers.get("x-cron-secret") || url.searchParams.get("secret");
  return dado === esperado;
}

async function handler(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Falta CRON_SECRET en el servidor." }, { status: 500 });
  }
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // La caché en memoria del proceso dura un minuto. Sin vaciarla, la página se
  // rehace leyendo lo de hace un rato y el aviso no serviría de nada.
  invalidarCacheTardeos();
  RUTAS.forEach((r) => revalidatePath(r));

  return NextResponse.json({ ok: true, rehechas: RUTAS });
}

export const GET = handler;
export const POST = handler;
