/**
 * Reduce una imagen en el navegador antes de subirla o mandarla a la IA.
 *
 * Una foto del móvil pesa 4-8 MB y 4000 px de lado: subirla tal cual tarda
 * una eternidad con mala cobertura y a la API de lectura le sobra (y puede
 * pasarse del límite de tamaño). Con 1600 px se lee perfectamente un flyer.
 *
 * Si algo falla (formato raro, navegador sin canvas…), devuelve el original:
 * mejor subir grande que no subir.
 */
export async function reducirImagen(file: File, maxLado = 1600, calidad = 0.85, forzar = false): Promise<File> {
  // GIF (puede ser animado) y SVG no se tocan; lo que no es imagen, tampoco.
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (typeof document === "undefined") return file;
  try {
    const url = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("imagen ilegible"));
        i.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    const ancho = img.naturalWidth, alto = img.naturalHeight;
    if (!ancho || !alto) return file;
    const escala = Math.min(1, maxLado / Math.max(ancho, alto));
    const w = Math.round(ancho * escala), h = Math.round(alto * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Fondo blanco: un PNG con transparencia pasado a JPEG saldría en negro.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", calidad));
    if (!blob) return file;
    // Si ya era pequeña y el JPEG sale más pesado, se queda la original
    // (salvo `forzar`: un HEIC hay que convertirlo aunque pese más).
    if (!forzar && escala === 1 && blob.size >= file.size) return file;
    const nombre = (file.name.replace(/\.[^.]+$/, "") || "imagen") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Tipos que admite el bucket `flyers` para imágenes (lote 73). */
const ADMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * La imagen lista para subir, o un error que se puede enseñar tal cual.
 *
 * Desde el lote 73 el almacenamiento solo acepta JPG, PNG, WebP y GIF. Un iPhone
 * da fotos HEIC por defecto y `accept="image/*"` las deja elegir: sin esto la
 * subida fallaba con un error técnico. Si el navegador sabe leerla (Safari sí),
 * se convierte a JPG; si no, se explica cómo sacarla en un formato que valga.
 */
export async function imagenParaSubir(file: File): Promise<File> {
  if (ADMITIDOS.has(file.type)) return reducirImagen(file);
  const convertida = await reducirImagen(file, 1600, 0.85, true);
  if (ADMITIDOS.has(convertida.type)) return convertida;
  throw new Error("Esa foto está en un formato que no se puede subir (por ejemplo HEIC del iPhone). Elige una JPG o PNG; en el iPhone: Ajustes › Cámara › Formatos › «Más compatible».");
}
