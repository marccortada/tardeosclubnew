import { getImageProps, type ImageLoaderProps } from "next/image";

/**
 * Fotos de ambiente de la portada, de Unsplash (licencia libre: uso comercial
 * sin atribución obligatoria). Se piden al CDN de Unsplash ya al tamaño
 * justo y en el formato que acepte el navegador; en <Image> van con
 * `unoptimized` para no convertirlas en nuestro servidor, que va justo.
 */
export const FOTOS = {
  remember: "1607890124765-92d34e0c8f13",
  electronica: "1574155376612-bfa4ed8aabfd",
  latino: "1758810409996-583f3bad7d51",
  sevillanas: "1533854257392-71c5ff28dff7",
  afterwork: "1699730164892-d7c433524ff3",
  vermut: "1550591683-18e1e4a4b9fa",
  bar: "1655459765544-39065b741a9e",
  dj: "1496337589254-7e19d01cec44",
  atardecer: "1611244806964-91d204d4a2a7",
  concierto: "1429962714451-bb934ecdc4ec",
} as const;

export function foto(id: string, ancho = 1200): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${ancho}&q=70`;
}

/**
 * Cargador de next/image que pide cada ancho al CDN de Unsplash. q=65: las
 * fotos de la portada van casi siempre bajo un tinte de color, y ahí la
 * diferencia con q=80 no se ve pero pesa un 30 % más.
 *
 * Tope de 2000 px: en un portátil con pantalla retina el srcset pedía la de
 * 3840 (146 KB) para una foto que va tintada y casi desenfocada; con 2000 se
 * queda en ~70 KB y no se nota.
 */
function cargadorUnsplash({ src, width }: ImageLoaderProps): string {
  return `${src}?auto=format&fit=crop&w=${Math.min(width, 2000)}&q=65`;
}

/**
 * Atributos de un <img> de Unsplash CON srcset (para usar en componentes de
 * servidor). Con `unoptimized` el navegador del móvil se bajaba la foto de
 * 1600–2340 px pensada para escritorio; con el srcset elige la de su
 * pantalla (≈750 px en un móvil de 375). No se usa <Image loader=…> porque
 * una función no puede pasar de un componente de servidor a uno de cliente;
 * getImageProps calcula lo mismo en el servidor y devuelve atributos planos.
 *
 * `prioridad` solo para la foto del hero: se pide la primera y sin `lazy`.
 */
export function propsFoto(id: string, { sizes, alt = "", prioridad = false }: { sizes: string; alt?: string; prioridad?: boolean }) {
  const { props } = getImageProps({
    src: `https://images.unsplash.com/photo-${id}`,
    alt,
    fill: true,
    sizes,
    loader: cargadorUnsplash,
    preload: prioridad,
    fetchPriority: prioridad ? "high" : undefined,
  });
  return props;
}
