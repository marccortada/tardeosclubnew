import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarAdminGlobal } from "@/lib/apiAuth";
import { registrar } from "@/lib/registro";

export const runtime = "nodejs";

/**
 * Datos de acceso de una cuenta para la ficha de usuario del admin.
 *
 * `auth.users` (último acceso, email confirmado, con qué entra) no se puede
 * leer desde el navegador: solo con la service role, que vive aquí. SOLO
 * lectura: esta ruta no cambia nada. También cuenta sus guardados (ver abajo). El token va en `Authorization: Bearer`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Identificador de usuario no válido." }, { status: 400 });
  }

  const auth = await autorizarAdminGlobal(undefined, req);
  if (auth instanceof NextResponse) return auth;

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data?.user) {
    // Perfil sin cuenta de acceso (p. ej. dueño migrado que nunca entró).
    if (!error || /not.?found/i.test(error.message) || error.status === 404) {
      return NextResponse.json({ existe: false });
    }
    registrar("admin-usuario", `no se pudo leer la cuenta ${id}`, error);
    return NextResponse.json({ error: "No se pudieron leer los datos de acceso." }, { status: 500 });
  }

  const u = data.user;
  // Cuántos guardados tiene de verdad: la tabla `favoritos` no sale de ningún
  // lote y su RLS puede no dejar leerla al admin desde el navegador; con este
  // número la ficha distingue "no tiene" de "no me dejan verlos".
  const fav = await admin.from("favoritos").select("tardeo_id", { count: "exact", head: true }).eq("profile_id", id);

  const proveedores = Array.isArray(u.app_metadata?.providers)
    ? (u.app_metadata.providers as string[])
    : u.app_metadata?.provider ? [String(u.app_metadata.provider)] : [];

  return NextResponse.json({
    existe: true,
    last_sign_in_at: u.last_sign_in_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
    proveedores,
    favoritos_total: fav.error ? null : fav.count ?? 0,
  });
}
