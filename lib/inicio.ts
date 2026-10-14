import { supabase } from "@/lib/supabase";

/**
 * A qué portal va cada cuenta nada más entrar (si no venía de ningún sitio
 * con ?volver=): el admin a /admin, quien lleva un local o eventos a /local,
 * el DJ a /dj y el tardícola a su cuenta. Antes todos caían en /perfil y el
 * local tenía que buscar su panel.
 *
 * Si alguna consulta falla, se va a /perfil: desde ahí están todos los
 * paneles y no se deja a nadie en una pantalla en blanco.
 */
export async function rutaDeInicio(uid: string): Promise<string> {
  try {
    const [perfil, local, dj] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", uid).maybeSingle(),
      supabase.from("locales").select("id").eq("owner_id", uid).limit(1).maybeSingle(),
      supabase.from("djs").select("id").eq("profile_id", uid).limit(1).maybeSingle(),
    ]);
    if (perfil.data?.is_admin) return "/admin";
    if (local.data) return "/local";
    if (dj.data) return "/dj";
  } catch { /* a la cuenta */ }
  return "/perfil";
}

/** Marca que se añade al volver de Google o del enlace mágico. */
export const TRAS_LOGIN = "/perfil?tras=login";
