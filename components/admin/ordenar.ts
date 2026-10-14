import { supabase } from "@/lib/supabase";

export type ResultadoOrden = { ok: true } | { ok: false; mensaje: string; faltaLote: boolean };

export const MENSAJE_FALTA_LOTE =
  "Falta pegar el lote 45 en Supabase: abre SQL Editor, pega supabase/45_destacados_orden.sql y ejecútalo. Hasta entonces el orden no se puede guardar.";

/**
 * Guarda el orden 1..N de una lista de destacados en UN solo paso
 * (`reordenar_destacados`, lote 45). Si la función no existe devuelve
 * `faltaLote` y NO escribe nada: nada de caer a escrituras fila a fila, que
 * dejarían el orden a medias si una falla.
 */
export async function guardarOrdenEnBloque(
  tabla: "tardeos" | "locales" | "djs",
  ids: string[],
): Promise<ResultadoOrden> {
  const { data, error } = await supabase.rpc("reordenar_destacados", { p_tabla: tabla, p_ids: ids });
  if (error) {
    const falta = error.code === "42883" || error.code === "PGRST202" || /could not find the function/i.test(error.message);
    return falta
      ? { ok: false, faltaLote: true, mensaje: MENSAJE_FALTA_LOTE }
      : { ok: false, faltaLote: false, mensaje: "No se pudo guardar el orden: " + error.message };
  }
  if (typeof data === "number" && data !== ids.length) {
    return { ok: false, faltaLote: false, mensaje: "La base guardó " + data + " de " + ids.length + " fichas. Recarga y revisa." };
  }
  return { ok: true };
}
