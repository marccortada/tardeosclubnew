import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarAdminGlobal, autorizarUsuario } from "@/lib/apiAuth";
import { registrar } from "@/lib/registro";

export const runtime = "nodejs";

/**
 * Borra una cuenta para siempre (auth.users → profiles en cascada).
 *
 *  - Sin `uid` en el cuerpo: la persona borra SU cuenta (desde /perfil/ajustes).
 *  - Con `uid`: un admin borra la de otra persona (panel de usuarios).
 *
 * Borrar un usuario solo se puede con la service role, que nunca sale del
 * servidor: por eso es una ruta y no una llamada desde el navegador.
 *
 * Las fichas de local y DJ NO se borran: su dueño pasa a null (lote 01 y 52) y
 * quedan "sin dueño", reclamables. Lo suyo de verdad (guardados, apuntados,
 * suscripción push…) se va en cascada.
 */
export async function POST(req: Request) {
  const cuerpo: { accessToken?: string; uid?: unknown } = await req.json().catch(() => ({}));
  const otro = typeof cuerpo.uid === "string" && cuerpo.uid ? cuerpo.uid : null;

  if (otro && !/^[0-9a-f-]{36}$/i.test(otro)) {
    return NextResponse.json({ error: "Identificador de usuario no válido." }, { status: 400 });
  }

  const auth = otro ? await autorizarAdminGlobal(cuerpo.accessToken, req) : await autorizarUsuario(cuerpo.accessToken, req);
  if (auth instanceof NextResponse) return auth;

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(URL, SERVICE_ROLE);
  const victima = otro ?? auth.uid;

  // Un admin no borra a otro admin desde aquí: con un solo clic se podría
  // dejar la web sin nadie que la gestione. Primero se le quita el permiso.
  if (otro && otro !== auth.uid) {
    const { data: p, error } = await admin.from("profiles").select("is_admin").eq("id", otro).maybeSingle();
    if (error) return NextResponse.json({ error: "No se pudo comprobar la cuenta." }, { status: 500 });
    if (p?.is_admin) {
      return NextResponse.json({ error: "Es una cuenta de administrador. Quítale antes el permiso de admin." }, { status: 409 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(victima);
  if (error) {
    // Supabase no da detalle: "Database error deleting user" casi siempre es
    // una clave ajena sin ON DELETE que impide borrar el perfil.
    const porBase = /database error/i.test(error.message);
    registrar("borrar-cuenta", `no se pudo borrar ${victima}`, error);
    if (/not.?found/i.test(error.message)) {
      // Perfil "fantasma": vino de la migración y nunca tuvo cuenta de acceso
      // (son la mayoría). No hay usuario que borrar, pero sí su perfil.
      const { data: fuera, error: eP } = await admin.from("profiles").delete().eq("id", victima).select("id");
      if (!eP && fuera?.length) return NextResponse.json({ ok: true, soloPerfil: true });
      if (eP) registrar("borrar-cuenta", `no se pudo borrar el perfil ${victima}`, eP);
      return NextResponse.json({ error: eP ? "No se pudo borrar el perfil (puede que falte pegar el lote 52)." : "Esa cuenta ya no existe." }, { status: eP ? 500 : 404 });
    }
    return NextResponse.json(
      {
        error: porBase
          ? "La base de datos no deja borrar la cuenta. Falta pegar el lote 52 (supabase/52_borrar_cuenta.sql) en Supabase."
          : "No se pudo borrar la cuenta. Inténtalo más tarde.",
        lote: porBase ? 52 : undefined,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
