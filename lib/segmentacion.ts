import type { AdnTardicola } from "./tardicola";
import { contiene } from "./adn";
import { familiaDe } from "./musica";

/** Los criterios de gustos con los que se puede acotar un pop-up. */
export type Segmento = {
  seg_musica?: string[] | null;
  seg_tipos_evento?: string[] | null;
  seg_edades?: string[] | null;
  seg_zonas?: string[] | null;
};

/**
 * ¿Le toca este pop-up a esta persona?
 *
 * Un criterio vacío no restringe: un pop-up con solo `seg_musica` llega a quien
 * le guste esa música, tenga la edad que tenga. Y los criterios puestos se
 * exigen TODOS (y lógico), porque quien compra una campaña para "mujeres de
 * 35-55 a las que les gusta el remember en el Maresme" está pidiendo esa
 * intersección, no la suma.
 *
 * Sin gustos rellenados, un pop-up segmentado NO se enseña. Es deliberado y va
 * en contra de enseñar más: si se enseñara "por si acaso", el anunciante
 * pagaría por un público que no ha pedido y el dato dejaría de valer nada.
 * Los pop-ups sin segmentar siguen llegando a todo el mundo.
 *
 * Todo esto se decide en el navegador y con el ADN de su propia fila: los
 * gustos de nadie salen nunca de su cuenta.
 */
export function encajaSegmento(p: Segmento, adn: AdnTardicola | null): boolean {
  const criterios: [string[] | null | undefined, string[]][] = [
    [p.seg_musica, adn?.musica ?? []],
    [p.seg_tipos_evento, adn?.tiposEvento ?? []],
    [p.seg_edades, adn?.publico ? [adn.publico] : []],
    [p.seg_zonas, adn?.zonas ?? []],
  ];

  for (const [pedido, suyo] of criterios) {
    if (!pedido?.length) continue;          // sin restricción
    if (!suyo.length) return false;         // se pide algo que no sabemos de él
    const coincide = pedido.some((v) => contiene(suyo, v) || cubiertoPorFamilia(v, suyo));
    if (!coincide) return false;
  }
  return true;
}

/**
 * Pedir "Electrónica" alcanza también a quien marcó solo "Afro House".
 *
 * Sin esto, un anunciante que segmenta por la familia entera se quedaría sin
 * la mayor parte de su público: el que se molesta en bajar al estilo concreto
 * es justo el más interesado. Solo funciona hacia abajo — pedir "Afro House"
 * no alcanza a quien puso "Electrónica" a secas, porque ahí no sabemos si le
 * gusta ese estilo en concreto.
 */
function cubiertoPorFamilia(pedido: string, suyo: string[]): boolean {
  if (pedido.includes(":")) return false;   // se pide un estilo concreto
  return suyo.some((s) => s.startsWith(`${pedido}:`) || familiaDe(s)?.id === pedido);
}

/** ¿Está el pop-up dentro de su ventana de fechas? */
export function enVentana(p: { desde?: string | null; hasta?: string | null }, ahora = Date.now()): boolean {
  if (p.desde && ahora < new Date(p.desde).getTime()) return false;
  if (p.hasta && ahora > new Date(p.hasta).getTime()) return false;
  return true;
}

// ---------- Tope diario ----------
const CLAVE_TOPE = "popups-impactos";

/**
 * Cuántos pop-ups se le han enseñado hoy.
 *
 * En el navegador y no en la base a propósito: llevar la cuenta en servidor
 * significaría una escritura por impresión y una tabla que crece sin parar,
 * para proteger al usuario de algo que él mismo puede saltarse borrando datos
 * del navegador. El tope está para no agobiar a nadie, no para auditar.
 */
export function impactosHoy(): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_TOPE) || "{}");
    return crudo.dia === hoy() ? Number(crudo.n) || 0 : 0;
  } catch {
    return 0;
  }
}

export function apuntarImpacto(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLAVE_TOPE, JSON.stringify({ dia: hoy(), n: impactosHoy() + 1 }));
  } catch {
    /* modo privado o almacenamiento lleno: mejor enseñar de más que reventar */
  }
}

/** El día en horario de España, que es donde vive el usuario. */
function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}
