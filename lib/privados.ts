import { supabase } from "@/lib/supabase";

/**
 * Datos privados de fichas: el email de contacto del local y las notas/referencias
 * de cobro (locales y DJs).
 *
 * Por qué van aparte: hasta el lote 78 cualquier usuario con sesión podía pedir
 * `locales.email` o `djs.pago_referencia` directamente a la API (los permisos por
 * columna solo se habían cerrado para anónimos). Ahora esas columnas no se leen
 * desde el navegador; se piden con `datos_privados_*`, que solo devuelve:
 *  - el email (o el contacto del DJ) a su dueño y al admin;
 *  - las notas y referencias de cobro, solo al admin.
 *
 * Sin el lote 78 la función no existe: entonces se leen de la tabla como antes,
 * para que la pantalla no se rompa mientras se aplica.
 */
export type Privados = {
  id: string;
  email: string | null;
  plan_notas: string | null;
  pago_proveedor: string | null;
  pago_referencia: string | null;
};

const NO_EXISTE = new Set(["PGRST202", "42883"]);

export async function leerPrivados(tabla: "locales" | "djs", ids: string[]): Promise<Map<string, Privados>> {
  const mapa = new Map<string, Privados>();
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return mapa;
  for (let i = 0; i < unicos.length; i += 200) {
    const trozo = unicos.slice(i, i + 200);
    const { data, error } = await supabase.rpc(`datos_privados_${tabla}`, { p_ids: trozo });
    if (!error) {
      for (const f of (data ?? []) as Privados[]) mapa.set(f.id, f);
      continue;
    }
    if (!NO_EXISTE.has(error.code ?? "")) continue; // sin permiso o fallo: se quedan vacíos
    // Base todavía sin el lote 78: lectura directa, como antes.
    const cols = tabla === "locales" ? "id,email,plan_notas,pago_proveedor,pago_referencia" : "id,contacto,plan_notas,pago_proveedor,pago_referencia";
    const r = await supabase.from(tabla).select(cols).in("id", trozo);
    for (const f of (r.data ?? []) as unknown as (Privados & { contacto?: string | null })[]) {
      mapa.set(f.id, { ...f, email: f.email ?? f.contacto ?? null });
    }
  }
  return mapa;
}
