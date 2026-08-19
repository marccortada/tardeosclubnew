import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Solo servidor. Usa la service role key, que nunca sale del servidor.

export type Autorizado = { uid: string; esAdmin: boolean };

/**
 * Verifica el token de sesión y que quien llama puede usar las rutas de IA:
 * un local dado de alta (dueño de un local) o un admin.
 *
 * Devuelve NextResponse si hay que cortar, o { uid, esAdmin } si pasa.
 */
export async function autorizarLocalOAdmin(accessToken?: string): Promise<NextResponse | Autorizado> {
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
export async function autorizarUsuario(accessToken?: string): Promise<NextResponse | Autorizado> {
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
export async function autorizarAdmin(accessToken?: string): Promise<NextResponse | Autorizado> {
  const auth = await autorizarLocalOAdmin(accessToken);
  if (auth instanceof NextResponse) return auth;
  if (!auth.esAdmin) {
    return NextResponse.json({ error: "Solo para administradores." }, { status: 403 });
  }
  return auth;
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
    console.error("[limite] faltan las credenciales de servidor");
    return false;
  }

  const admin = createClient(URL, SERVICE_ROLE);
  const { data, error } = await admin.rpc("consumir_cuota", {
    p_clave: clave,
    p_max: maxPorHora,
  });

  if (error) {
    console.error("[limite] no se pudo consultar la cuota:", error.message);
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
