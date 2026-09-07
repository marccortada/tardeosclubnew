import { supabase } from "./supabase";
import { memo } from "./memo";
import { registrar } from "./registro";

/**
 * Ajustes generales, en la tabla `ajustes` del lote 23 (la misma que guarda el
 * tope diario de pop-ups). Los lee cualquiera; solo los escribe un admin.
 */

/**
 * ¿Están en vigor las reglas de los planes?
 *
 * Apagado por defecto Y A PROPÓSITO. Hoy hay 68 locales, 64 sin dueño y ninguno
 * pagando: encender las reglas ahora solo quitaría el logo a fichas propias sin
 * que nadie gane nada. El interruptor está en el panel de admin, y el día que
 * haya locales pagando se enciende y las reglas entran en vigor de golpe.
 *
 * Mientras está apagado, TODO el mundo puede TODO: la app se comporta como
 * hasta ahora. Eso permite tener las reglas escritas y probadas mucho antes de
 * usarlas, en vez de escribirlas con prisa el día que llegue el primer cliente.
 */
export const CLAVE_PLANES = "planes_activos";

const memoAjustes = memo("ajustes", async () => {
  const { data, error } = await supabase.from("ajustes").select("clave,valor");
  if (error) {
    registrar("ajustes", "no se pudieron leer los ajustes", error);
    return {} as Record<string, string>;
  }
  return Object.fromEntries((data ?? []).map((a) => [a.clave, a.valor])) as Record<string, string>;
}, 30_000);

export async function getAjustes(): Promise<Record<string, string>> {
  return memoAjustes.get();
}

/** Vacía la caché: al cambiar un ajuste desde el panel debe notarse ya. */
export function invalidarAjustes() {
  memoAjustes.invalidar();
}

export async function planesActivos(): Promise<boolean> {
  const a = await getAjustes();
  // Ante la duda, apagado. Un fallo leyendo el ajuste NO debe cortarle
  // funciones a nadie de golpe.
  return a[CLAVE_PLANES] === "true";
}

export async function setAjuste(clave: string, valor: string) {
  const r = await supabase.from("ajustes").upsert({ clave, valor }, { onConflict: "clave" }).select("clave");
  invalidarAjustes();
  return r;
}
