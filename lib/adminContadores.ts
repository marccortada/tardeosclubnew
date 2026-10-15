"use client";

import { supabase } from "./supabase";

/**
 * Lo que está esperando al admin, en números. SOLO LECTURA: no escribe nada y
 * no toca la lógica de planes.
 *
 * Todo son recuentos (`head: true`): antes se bajaban `plan_estado` y
 * `plan_hasta` de TODOS los locales y DJs para contarlos en el navegador, y
 * PostgREST corta a 1.000 filas, así que con más fichas la cifra salía corta.
 *
 * Cada cifra es `null` si no se pudo leer (falta un lote de SQL, sin permiso…):
 * mejor "—" que un 0 que haga creer que no hay nada pendiente.
 */
export type Contadores = {
  resenas: number | null;
  flyers: number | null;
  reclamaciones: number | null;
  localesPorVerificar: number | null;
  impagos: number | null;
  caducadas: number | null;
  vencenPronto: number | null;
  /** Avisos de la gente que nadie ha mirado aún (lote 57). */
  incidencias: number | null;
  /**
   * Abiertas en la cola de trabajo (lote 69), la misma cifra que /admin/cola.
   * Es la buena para «Cola de trabajo»: ya filtra por zona y quita lo marcado
   * como hecho o descartado, cosa que la suma de las tablas sueltas no hace.
   * No incluye reseñas (no son fuente de la cola): van aparte.
   */
  cola: number | null;
};

const contar = async (q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> => {
  try {
    const { count, error } = await q;
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
};

/** Suma locales + DJs; si cualquiera de las dos falla, no se inventa la cifra. */
const sumar = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);

export async function leerContadores(): Promise<Contadores> {
  const ahora = new Date();
  const ya = ahora.toISOString();
  const en14 = new Date(ahora.getTime() + 14 * 86_400_000).toISOString();

  // Mismo recuento en las dos tablas que tienen plan. El constructor se tipa a
  // mano con lo poco que se usa: el tipo real no se deja reutilizar entre tablas.
  type Recuento = PromiseLike<{ count: number | null; error: unknown }> & {
    eq(c: string, v: string): Recuento; lt(c: string, v: string): Recuento;
    gte(c: string, v: string): Recuento; lte(c: string, v: string): Recuento;
  };
  const enAmbas = (f: (q: Recuento) => Recuento) =>
    Promise.all((["locales", "djs"] as const).map((t) =>
      contar(f(supabase.from(t).select("id", { count: "exact", head: true }) as unknown as Recuento))));

  const [resenas, flyers, reclamaciones, localesPorVerificar, imp, cad, ven, incidencias, cola] = await Promise.all([
    contar(supabase.from("resenas").select("id", { count: "exact", head: true }).in("estado", ["pendiente", "apelada"])),
    contar(supabase.from("denuncias_flyer").select("id", { count: "exact", head: true }).eq("estado", "pendiente")),
    contar(supabase.from("solicitudes_reclamacion").select("id", { count: "exact", head: true }).eq("estado", "pendiente")),
    // Mismo criterio que la lista de "por verificar": solo borradores.
    contar(supabase.from("locales").select("id", { count: "exact", head: true }).eq("estado", "borrador")),
    enAmbas((q) => q.eq("plan_estado", "impago")),
    enAmbas((q) => q.eq("plan_estado", "activa").lt("plan_hasta", ya)),
    enAmbas((q) => q.eq("plan_estado", "activa").gte("plan_hasta", ya).lte("plan_hasta", en14)),
    // Sin lote 57 la petición HEAD no trae error pero tampoco cifra: eso es
    // «no se sabe», no un 0.
    supabase.from("incidencias").select("id", { count: "exact", head: true }).eq("estado", "abierta")
      .then((r) => (r.error ? null : r.count), () => null),
    // Solo el total: se pide una fila y la RPC trae la cuenta en `total`.
    supabase.rpc("cola_trabajo", { p_tipo: null, p_zona: null, p_solo_mias: false, p_estado: "abiertas", p_limite: 1, p_desde: 0 })
      .then(({ data, error }) => (error ? null : Number((data as { total: number }[] | null)?.[0]?.total ?? 0)), () => null),
  ]);

  return {
    resenas, flyers, reclamaciones, localesPorVerificar, incidencias, cola,
    impagos: sumar(imp[0], imp[1]),
    caducadas: sumar(cad[0], cad[1]),
    vencenPronto: sumar(ven[0], ven[1]),
  };
}
