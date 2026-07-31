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
    return NextResponse.json({ error: "Inicia sesión para usar la IA." }, { status: 401 });
  }

  const admin = createClient(URL, SERVICE_ROLE);

  const { data: userData } = await admin.auth.getUser(accessToken);
  const uid = userData?.user?.id;
  if (!uid) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  if (prof?.is_admin) return { uid, esAdmin: true };

  const { data: local } = await admin.from("locales").select("id").eq("owner_id", uid).limit(1).maybeSingle();
  if (!local) {
    return NextResponse.json({ error: "Necesitas tener un local dado de alta para usar la IA." }, { status: 403 });
  }

  return { uid, esAdmin: false };
}

// ---------- Límite de uso ----------
// En memoria del proceso: se reinicia en cada despliegue y no se comparte
// entre instancias. Suficiente para frenar el abuso obvio de un endpoint que
// cuesta dinero por llamada. Si algún día hay varias instancias, esto debe
// pasar a Supabase o a un Redis.
const usos = new Map<string, number[]>();

export function pasaLimite(clave: string, maxPorHora: number): boolean {
  const ahora = Date.now();
  const hace1h = ahora - 60 * 60 * 1000;
  const previos = (usos.get(clave) ?? []).filter((t) => t > hace1h);
  if (previos.length >= maxPorHora) {
    usos.set(clave, previos);
    return false;
  }
  previos.push(ahora);
  usos.set(clave, previos);

  // Limpieza perezosa para que el Map no crezca sin fin.
  if (usos.size > 500) {
    for (const [k, v] of usos) {
      const vivos = v.filter((t) => t > hace1h);
      if (vivos.length === 0) usos.delete(k);
      else usos.set(k, vivos);
    }
  }
  return true;
}

export function respuestaLimite(que: string) {
  return NextResponse.json(
    { error: `Has llegado al límite de ${que} por hora. Prueba de nuevo más tarde.` },
    { status: 429 }
  );
}
