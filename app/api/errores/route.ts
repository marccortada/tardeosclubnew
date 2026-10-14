import { createClient } from "@supabase/supabase-js";
import { guardarErrorServidor, recortar, rutaGenerica } from "@/lib/erroresApp";

export const runtime = "nodejs";

/**
 * Recibe los errores que pasan en el navegador (CapturaErrores, error.tsx) y
 * los guarda agrupados en `errores_app` (lote 57) con la service role.
 *
 * Es una puerta abierta a cualquiera, así que:
 *  - Cuerpo de 16 KB como mucho; todo se recorta antes de guardar.
 *  - Tope por IP en memoria (20 por 10 minutos). No es perfecto —se reinicia
 *    al desplegar y no se comparte entre instancias—, pero aquí no hay dinero
 *    en juego: solo evita que una pestaña en bucle llene la tabla.
 *  - Responde SIEMPRE 204 y nunca da detalles: quien la llame para probar no
 *    sabe si se guardó, si hay base o si le han frenado.
 */
const MAX_CUERPO = 16_000;
const VENTANA = 10 * 60_000;
const MAX_POR_IP = 20;
const usos = new Map<string, { desde: number; n: number }>();

function pasa(ip: string): boolean {
  const ahora = Date.now();
  // Limpieza perezosa para que el mapa no crezca sin fin.
  if (usos.size > 5000) for (const [k, v] of usos) if (ahora - v.desde > VENTANA) usos.delete(k);
  const u = usos.get(ip);
  if (!u || ahora - u.desde > VENTANA) { usos.set(ip, { desde: ahora, n: 1 }); return true; }
  u.n++;
  return u.n <= MAX_POR_IP;
}

// Tope GLOBAL por minuto, además del de IP: la IP se puede falsear con
// cabeceras, el total no.
const MAX_GLOBAL_MINUTO = 60;
let global = { desde: 0, n: 0 };
function pasaGlobal(): boolean {
  const ahora = Date.now();
  if (ahora - global.desde > 60_000) global = { desde: ahora, n: 0 };
  global.n++;
  return global.n <= MAX_GLOBAL_MINUTO;
}

/** La IP que pone el proxy (x-real-ip, o el ÚLTIMO de x-forwarded-for), no
 *  la que el cliente puede escribir al principio de x-forwarded-for. */
function ipDe(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return xff[xff.length - 1] ?? "?";
}

const nada = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  try {
    if (!pasa(ipDe(req)) || !pasaGlobal()) return nada();

    // Otra web no tiene por qué mandarnos errores.
    const origen = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origen && host) {
      try { if (new URL(origen).host !== host) return nada(); } catch { return nada(); }
    }

    const texto = await req.text();
    if (!texto || texto.length > MAX_CUERPO) return nada();
    const b = JSON.parse(texto) as Record<string, unknown>;

    const mensaje = recortar(b.mensaje, 1000);
    if (!mensaje) return nada();
    const url = recortar(b.url, 500);

    // Quién era, si venía con sesión. Se comprueba el token: un id suelto en
    // el cuerpo se podría inventar.
    let profileId: string | null = null;
    const token = recortar(b.token, 4000);
    const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (token && URL_SB && KEY) {
      try {
        const { data } = await createClient(URL_SB, KEY).auth.getUser(token);
        profileId = data?.user?.id ?? null;
      } catch { /* sin perfil */ }
    }

    await guardarErrorServidor({
      mensaje,
      pila: recortar(b.pila, 4000),
      url,
      ruta: rutaGenerica(url),
      origen: "cliente",
      userAgent: recortar(req.headers.get("user-agent"), 400),
      profileId,
    });
  } catch {
    /* nunca se devuelve el detalle */
  }
  return nada();
}
