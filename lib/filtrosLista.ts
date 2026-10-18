import { finDelDiaMadrid } from "@/components/admin/fechas";

/**
 * Ayudas comunes para filtrar listas EN EL SERVIDOR (Supabase).
 *
 * Por qué aquí: las pantallas de filtros repetían la misma limpieza del texto
 * y el mismo cálculo de "desde/hasta" en hora de Madrid. Si cada una lo hace a
 * su manera, un mismo día da resultados distintos según la pantalla.
 */

/**
 * Quita del texto lo que rompe la sintaxis de `.or()` / `.ilike()` de PostgREST
 * (comas, paréntesis, comodines, comillas). Lo que queda se busca tal cual.
 */
export const limpiarBusqueda = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

/** Instante (ISO) del primer segundo de un día 'YYYY-MM-DD' en hora de Madrid. */
export function inicioDelDiaMadrid(fecha: string): string {
  // = un segundo después del último segundo del día anterior (con su cambio de hora).
  const [y, m, d] = fecha.split("-").map(Number);
  const ayer = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return new Date(Date.parse(finDelDiaMadrid(ayer)) + 1000).toISOString();
}

/** Lo mínimo de una consulta de Supabase que usa `rangoTimestamp`. */
type ConRango = { gte(c: string, v: string): ConRango; lte(c: string, v: string): ConRango };

/**
 * Aplica un rango de días (valores de <input type="date">, "" = sin límite) a
 * una columna timestamptz. Los días se entienden en hora de Madrid: "hasta el
 * 18" incluye lo de las 23:30 del 18, que en UTC ya es día 19.
 */
export function rangoTimestamp<Q>(q: Q, columna: string, desde: string, hasta: string): Q {
  let r = q as unknown as ConRango;
  if (desde) r = r.gte(columna, inicioDelDiaMadrid(desde));
  if (hasta) r = r.lte(columna, finDelDiaMadrid(hasta));
  return r as unknown as Q;
}

/** Igual, para columnas `date` (sin hora): se compara el texto 'YYYY-MM-DD'. */
export function rangoFecha<Q>(q: Q, columna: string, desde: string, hasta: string): Q {
  let r = q as unknown as ConRango;
  if (desde) r = r.gte(columna, desde);
  if (hasta) r = r.lte(columna, hasta);
  return r as unknown as Q;
}
