import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { registrar } from "./registro";

// Solo servidor. Usa la service role key, que nunca sale del servidor.

export type Autorizado = { uid: string; esAdmin: boolean };

/**
 * Verifica el token de sesión y que quien llama puede usar las rutas de IA:
 * un local dado de alta (dueño de un local) o un admin.
 *
 * Devuelve NextResponse si hay que cortar, o { uid, esAdmin } si pasa.
 */
export async function autorizarLocalOAdmin(tokenCuerpo?: string, req?: Request): Promise<NextResponse | Autorizado> {
  const accessToken = tokenDe(req, tokenCuerpo);
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE_ROLE) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Inicia sesión para hacer esto." }, { status: 401 });
  }

  const admin = createClient(URL, SERVICE_ROLE);

  const { data: userData } = await admin.auth.getUser(accessToken);
  const uid = userData?.user?.id;
  if (!uid) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  if (prof?.is_admin) return { uid, esAdmin: true };

  const { data: local } = await admin.from("locales").select("id").eq("owner_id", uid).limit(1).maybeSingle();
  if (!local) {
    return NextResponse.json({ error: "Necesitas tener un local dado de alta." }, { status: 403 });
  }

  return { uid, esAdmin: false };
}

/**
 * Solo comprueba que hay sesión iniciada. No exige tener local.
 *
 * Para lo que hace falta ANTES de tener ficha: el alta de un local pide la
 * dirección, y con `autorizarLocalOAdmin` se daría 403 justo en el momento de
 * darse de alta. Sigue habiendo puerta —hay que tener cuenta— y el tope por
 * hora se cuenta igual, que es lo que protege la cuota de Google.
 */
export async function autorizarUsuario(tokenCuerpo?: string, req?: Request): Promise<NextResponse | Autorizado> {
  const accessToken = tokenDe(req, tokenCuerpo);
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE_ROLE) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Inicia sesión para hacer esto." }, { status: 401 });
  }

  const admin = createClient(URL, SERVICE_ROLE);
  const { data: userData } = await admin.auth.getUser(accessToken);
  const uid = userData?.user?.id;
  if (!uid) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  return { uid, esAdmin: !!prof?.is_admin };
}

/**
 * Como autorizarLocalOAdmin, pero SOLO admin. Para rutas que actúan sobre toda
 * la base de usuarios, como mandar una notificación push a todo el mundo: eso
 * no es algo que deba poder hacer un local.
 */
export async function autorizarAdmin(tokenCuerpo?: string, req?: Request): Promise<NextResponse | Autorizado> {
  const auth = await autorizarLocalOAdmin(tokenCuerpo, req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.esAdmin) {
    return NextResponse.json({ error: "Solo para administradores." }, { status: 403 });
  }
  return auth;
}

/**
 * ¿Admin GLOBAL? Desde el lote 69 hay admins «de zona» o «de tarea» (sorteos,
 * moderación, comercial…): siguen teniendo `is_admin`, pero no deben poder
 * hacer lo que toca a toda la base. Misma regla que `private.es_admin_global()`:
 * admin sin filas en `admin_roles`, o con una fila 'global'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- vale cualquier cliente con service role
export async function esAdminGlobal(admin: SupabaseClient<any, any, any>, uid: string): Promise<boolean> {
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  if (!(prof as { is_admin?: boolean } | null)?.is_admin) return false;
  const { data: roles, error } = await admin.from("admin_roles").select("tarea").eq("profile_id", uid);
  // Sin lote 69 (tabla inexistente) todos los admins son globales, como antes.
  if (error) return true;
  const lista = (roles ?? []) as { tarea: string }[];
  return lista.length === 0 || lista.some((r) => r.tarea === "global");
}

/**
 * Como autorizarAdmin, pero solo admin GLOBAL. Para lo que afecta a toda la
 * base: push a todo el mundo, ofertas por email, borrar cuentas ajenas, datos
 * de cualquier usuario. Un admin de zona o de tarea recibe 403.
 */
export async function autorizarAdminGlobal(tokenCuerpo?: string, req?: Request): Promise<NextResponse | Autorizado> {
  const auth = await autorizarAdmin(tokenCuerpo, req);
  if (auth instanceof NextResponse) return auth;
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!(await esAdminGlobal(createClient(URL, SERVICE_ROLE), auth.uid))) {
    return NextResponse.json({ error: "Solo un administrador general puede hacer esto." }, { status: 403 });
  }
  return auth;
}

/**
 * Token de sesión de la petición: cabecera `Authorization: Bearer <token>` si
 * viene, y si no el del cuerpo (`accessToken`), que es lo que usa el cliente
 * actual. Compatible hacia atrás: pasar solo el token del cuerpo sigue valiendo.
 */
export function tokenDe(req?: Request, tokenCuerpo?: string): string | undefined {
  const cab = req?.headers.get("authorization");
  const m = cab ? /^Bearer\s+(.+)$/i.exec(cab.trim()) : null;
  return m?.[1] || tokenCuerpo || undefined;
}

/**
 * ¿La petición trae el secreto de cron correcto en la cabecera `x-cron-secret`?
 * Solo cabecera (nunca en la URL, que acaba en logs) y comparación en tiempo
 * constante. Con distinta longitud se compara el secreto consigo mismo para no
 * dar pistas por tiempo y se devuelve false.
 */
export function secretoCronValido(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const dado = req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

// ---------- Push: validación de entradas ----------
const HOSTS_PUSH_EXACTOS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const HOSTS_PUSH_SUFIJOS = [".notify.windows.com", ".push.apple.com", ".fcm.googleapis.com", ".push.services.mozilla.com"];

/**
 * ¿Es un endpoint de push de un servicio conocido? Exige https y que el host
 * sea exactamente uno de la lista o un subdominio de ella. Evita que el
 * servidor haga peticiones a direcciones arbitrarias (SSRF) al enviar.
 */
export function endpointPushPermitido(endpoint: unknown): boolean {
  if (typeof endpoint !== "string") return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  return HOSTS_PUSH_EXACTOS.includes(h) || HOSTS_PUSH_SUFIJOS.some((s) => h.endsWith(s));
}

/**
 * Ruta interna segura para abrir desde una notificación: una sola "/" inicial
 * y el segundo carácter no puede ser "/" ni "\\" (`//evil.com`, `/\\evil.com`).
 * Si no cumple, devuelve el valor por defecto.
 */
export function urlInternaSegura(url: unknown, porDefecto = "/tardeos"): string {
  if (typeof url !== "string" || url.length > 500) return porDefecto;
  if (!url.startsWith("/")) return porDefecto;
  if (url[1] === "/" || url[1] === "\\") return porDefecto;
  if (/[\u0000-\u001f]/.test(url)) return porDefecto;
  return url;
}

// ---------- Límite de uso ----------
/**
 * Cuenta los usos de la última hora en Supabase (tabla `uso_ia`, Lote 15).
 *
 * Antes vivía en un Map en memoria del proceso, con dos problemas: se ponía a
 * cero en cada despliegue, y con más de una instancia cada una llevaba su
 * cuenta, así que el tope real se multiplicaba por el número de contenedores.
 * En un endpoint que se paga por imagen, eso es dinero.
 *
 * Falla CERRADO a propósito: si no podemos contar, no dejamos pasar. Preferimos
 * que la IA no funcione un rato a que alguien la use sin freno.
 */
export async function pasaLimite(clave: string, maxPorHora: number): Promise<boolean> {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE_ROLE) {
    registrar("limite", "faltan las credenciales de servidor: la cuota de IA no se puede comprobar");
    return false;
  }

  const admin = createClient(URL, SERVICE_ROLE);
  const { data, error } = await admin.rpc("consumir_cuota", {
    p_clave: clave,
    p_max: maxPorHora,
  });

  if (error) {
    registrar("limite", "no se pudo consultar la cuota de IA", error);
    return false;
  }
  return data === true;
}

export function respuestaLimite(que: string) {
  return NextResponse.json(
    { error: `Has llegado al límite de ${que} por hora. Prueba de nuevo más tarde.` },
    { status: 429 }
  );
}
