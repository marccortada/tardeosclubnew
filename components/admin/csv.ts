/**
 * Exportar listas del admin a CSV. Mismo formato que el Registro de
 * asistencias: punto y coma + BOM (Excel en español lo abre bien) y celdas a
 * prueba de inyección de fórmulas.
 */

/**
 * Excel ejecuta lo que empieza por = + - @ (y tabulador / retorno): un nombre
 * como «=HYPERLINK(...)» sería un enlace activo al abrir el fichero. Con una
 * comilla simple delante se queda en texto.
 */
export const celdaCsv = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

/** Genera y descarga el fichero en el navegador. */
export function descargarCsv(nombre: string, cabecera: string[], filas: unknown[][]) {
  const lineas = [cabecera, ...filas].map((f) => f.map(celdaCsv).join(";"));
  const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lee TODO lo que devuelve una consulta en lotes de 1000 (el tope de PostgREST
 * por petición). `pedir` debe traer ya los filtros y el orden: aquí solo se
 * añade el rango. Tope de seguridad: 100.000 filas.
 */
export async function leerPorLotes<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  progreso?: (n: number) => void,
): Promise<{ filas: T[]; error: string | null }> {
  const filas: T[] = [];
  for (let desde = 0; desde < 100000; desde += 1000) {
    const { data, error } = await pedir(desde, desde + 999);
    if (error) return { filas, error: error.message };
    filas.push(...(data ?? []));
    progreso?.(filas.length);
    if ((data ?? []).length < 1000) break;
  }
  return { filas, error: null };
}

/** Fecha de hoy (Madrid) para el nombre del fichero. */
export const hoyFichero = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
