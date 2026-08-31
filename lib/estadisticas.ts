import { supabase } from "./supabase";

/**
 * El resumen de lo que hace la gente, para el panel de administración.
 *
 * Todo sale de UNA llamada a `metricas_resumen` (lote 36), que agrega en la
 * base y devuelve los bloques ya contados. No se traen las filas al navegador
 * a propósito: hoy hay dos y daría igual, pero esto crece una fila por cada
 * visita de cada persona, y el día que haya cien mil no se arregla sin
 * rehacerlo entero.
 */

export type Resumen = {
  total: number;
  personas: number;
  por_tipo: { tipo: string; total: number }[];
  por_dia: { dia: string; tipo: string; total: number }[];
  top_tardeos: { id: string; titulo: string; fecha: string; total: number }[];
  top_locales: { id: string; nombre: string; total: number }[];
  top_djs: { id: string; nombre: string; total: number }[];
  busquedas: { texto: string; total: number; sin_resultados: number }[];
  filtros: { filtro: string; total: number }[];
  ticketeras: { dominio: string; total: number }[];
};

export const RESUMEN_VACIO: Resumen = {
  total: 0, personas: 0, por_tipo: [], por_dia: [], top_tardeos: [],
  top_locales: [], top_djs: [], busquedas: [], filtros: [], ticketeras: [],
};

/** Cómo se llama cada tipo en cristiano, y en qué orden se enseña. */
export const NOMBRES: Record<string, string> = {
  vista_home: "Portada",
  vista_listado: "Listado",
  vista_mapa: "Mapa",
  vista_tardeo: "Fichas de tardeo",
  vista_local: "Fichas de local",
  vista_dj: "Fichas de DJ",
  busqueda: "Búsquedas",
  busqueda_vacia: "Búsquedas sin resultados",
  filtro: "Filtros usados",
  para_ti_visto: "«Para ti» enseñado",
  para_ti_clic: "«Para ti» pulsado",
  favorito: "Guardados",
  inscripcion: "Apuntados",
  clic_entrada: "Clic a comprar",
  clic_lista: "Clic a lista",
};

/** El orden del embudo: de cómo entran a lo que acaban haciendo. */
export const ORDEN = [
  "vista_home", "vista_listado", "vista_mapa",
  "busqueda", "busqueda_vacia", "filtro",
  "vista_tardeo", "vista_local", "vista_dj",
  "para_ti_visto", "para_ti_clic",
  "favorito", "inscripcion", "clic_entrada", "clic_lista",
];

export async function cargarResumen(dias: number): Promise<{ datos: Resumen; error: string | null }> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await supabase.rpc("metricas_resumen", {
    p_desde: desde,
    p_hasta: new Date().toISOString(),
  });

  if (error) {
    // 42883 = la función no existe todavía; PGRST202 = PostgREST no la ve.
    const falta = error.code === "42883" || error.code === "PGRST202";
    return {
      datos: RESUMEN_VACIO,
      error: falta
        ? "Falta pegar el lote 36 (supabase/36_metricas_ampliadas.sql)."
        : error.message,
    };
  }
  return { datos: { ...RESUMEN_VACIO, ...(data ?? {}) }, error: null };
}

/**
 * Cuántos de los que vieron el "Para ti" acabaron pulsando.
 *
 * Se devuelve `null` y no 0 cuando no se ha enseñado nunca: un 0 % se lee como
 * "no funciona", y lo que pasa es que no ha habido ocasión de saberlo.
 */
export function tasaParaTi(r: Resumen): number | null {
  const t = (k: string) => r.por_tipo.find((x) => x.tipo === k)?.total ?? 0;
  const vistos = t("para_ti_visto");
  return vistos > 0 ? Math.round((t("para_ti_clic") / vistos) * 100) : null;
}

/** Lo mismo para el paso que de verdad da dinero: de ver una ficha a ir a comprar. */
export function tasaCompra(r: Resumen): number | null {
  const t = (k: string) => r.por_tipo.find((x) => x.tipo === k)?.total ?? 0;
  const fichas = t("vista_tardeo");
  return fichas > 0 ? Math.round(((t("clic_entrada") + t("clic_lista")) / fichas) * 100) : null;
}
