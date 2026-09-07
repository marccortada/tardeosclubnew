/**
 * Cuándo se ofrece instalar la app, y cuándo no.
 *
 * Vive aparte del componente porque LO IMPORTANTE de esto son los casos en los
 * que NO hay que aparecer, y eso no se puede comprobar mirando la pantalla: un
 * aviso que sale cuando no toca no se ve en una captura, se ve en la cara de
 * quien lo recibe por tercera vez.
 */

/** iPhone y iPad, que es donde no existe el diálogo de instalación. */
export const esApple = (ua: string): boolean => /iphone|ipad|ipod/i.test(ua);

export type Contexto = {
  /** Ya se está usando como app instalada. */
  instalada: boolean;
  /** Ancho de la ventana en píxeles. */
  ancho: number;
  /** Dijo «no volver a mostrar». */
  nunca: boolean;
  /** Cuándo dijo «ahora no», en milisegundos. 0 = nunca lo dijo. */
  luego: number;
  /** Ahora, en milisegundos. */
  ahora: number;
};

export const UNA_SEMANA = 7 * 24 * 3600 * 1000;
/** Debajo de esto se considera móvil. Es el corte de Tailwind para `md`. */
export const ANCHO_MOVIL = 767;

/**
 * ¿Se le puede ofrecer a esta persona, aquí y ahora?
 *
 * Las cinco condiciones, y el porqué de cada una:
 *
 *   · instalada  -> ofrecer instalar algo que ya está instalado es decirle a
 *                   alguien que no sabe usar su propio móvil.
 *   · ancho      -> en un portátil, «añádela a la pantalla de inicio» no
 *                   significa nada para casi nadie.
 *   · nunca      -> dijo que no. Se acabó.
 *   · luego      -> dijo «ahora no». Una semana de tregua; insistir al día
 *                   siguiente es lo que convierte un aviso en una molestia.
 */
export function sePuedeOfrecer(c: Contexto): boolean {
  if (c.instalada) return false;
  if (c.ancho > ANCHO_MOVIL) return false;
  if (c.nunca) return false;
  if (c.luego && c.ahora - c.luego < UNA_SEMANA) return false;
  return true;
}
