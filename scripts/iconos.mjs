/**
 * Genera los iconos que se sirven CRUDOS, sin pasar por next/image.
 *
 * El arte original son PNG de 3840px y hasta 19 MB. Eso vale para imprimir,
 * pero aquí acababa siendo el favicon de cada página y el badge de cada
 * notificación push: megas que se baja el móvil del usuario para pintar algo
 * de 24 píxeles. next/image no los toca porque el favicon, el manifest, el
 * service worker y Open Graph referencian la ruta a pelo.
 *
 * Se ejecuta a mano cuando cambie el arte de marca:  node scripts/iconos.mjs
 */
import sharp from "sharp";

/** Arte original. Fuera de public/ a propósito: son 21 MB que se copiaban
 *  enteros dentro de la imagen de producción sin que nadie los pidiera. */
const FUENTE = "disenyo/marca";
const DIR = "public/branding";

const tareas = [
  // Favicon, icono del manifest y de las notificaciones.
  { de: "icon.png", a: "icon-192.png", w: 192, h: 192 },
  // Icono grande del manifest y apple-touch (iOS lo reescala solo).
  { de: "icon.png", a: "icon-512.png", w: 512, h: 512 },
  // Badge de las push: Android lo pinta como silueta monocroma diminuta.
  { de: "emblema.png", a: "badge-96.png", w: 96, h: 96 },
];

for (const { de, a, w, h } of tareas) {
  const info = await sharp(`${FUENTE}/${de}`)
    .resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${DIR}/${a}`);
  console.log(`  ${a.padEnd(16)} ${w}x${h}  ${(info.size / 1024).toFixed(1)} KB`);
}

// Icono "maskable": Android lo recorta a círculo o squircle según el móvil, así
// que el logo va al 60% sobre fondo blanco. Con el icono normal (que llena todo
// el cuadro) el recorte se comía la copa y las ondas de los lados.
const mask = await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([{ input: await sharp(`${FUENTE}/icon.png`).resize(308, 308, { fit: "inside" }).toBuffer() }])
  .png({ compressionLevel: 9, palette: true })
  .toFile(`${DIR}/icon-maskable-512.png`);
console.log(`  ${"icon-maskable".padEnd(16)} 512x512  ${(mask.size / 1024).toFixed(1)} KB`);

// Open Graph: 1200x630 es lo que esperan WhatsApp, Twitter y Facebook. El logo
// es cuadrado, así que va centrado sobre blanco en vez de recortado: si se
// recorta un cuadrado a 1200x630 se pierden la copa y el "Club".
const og = await sharp(`${FUENTE}/logo.png`)
  .resize(1100, 560, { fit: "inside" })
  .extend({
    top: 35, bottom: 35, left: 50, right: 50,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .resize(1200, 630, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  // Paleta: el logo son cuatro colores planos sobre blanco, no necesita 24 bits.
  // WhatsApp se salta la previsualización de las imágenes muy pesadas.
  .png({ compressionLevel: 9, palette: true })
  .toFile(`${DIR}/og.png`);
console.log(`  ${"og.png".padEnd(16)} 1200x630  ${(og.size / 1024).toFixed(1)} KB`);
