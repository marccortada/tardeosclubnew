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
