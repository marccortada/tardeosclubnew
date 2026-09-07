/**
 * Genera el guion de grabación en HTML a partir de `lib/flujos.ts`.
 *
 * SE GENERA, no se escribe a mano, y ese es el punto. Un guion en un documento
 * suelto se queda viejo en cuanto cambia un flujo, y entonces se graban vídeos
 * de cosas que ya no son así. Aquí la única fuente es el catálogo del código:
 * si alguien añade un flujo, el guion sale actualizado sin tocar nada.
 *
 *   node scripts/guion-evidencias.mjs > /tmp/guion.html
 */
import { FLUJOS, ROLES, ORDEN_DE_GRABACION, flujosDe, nombreDeFichero } from "../lib/flujos.ts";

const version = process.env.VERSION ?? "1.0.0";
const entorno = process.env.ENTORNO ?? "crm.gnerai.com";
const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const seccion = (rol) => {
  const fs = flujosDe(rol);
  if (!fs.length) return "";
  return `
  <h2>${esc(ROLES[rol])} <span class="n">${fs.length} ${fs.length === 1 ? "vídeo" : "vídeos"}</span></h2>
  ${fs.map((f, i) => `
  <div class="flujo">
    <p class="cab"><span class="num">${i + 1}</span> ${esc(f.titulo)} <span class="cod">${esc(f.codigo)}</span></p>
    <p class="meta">Empieza en <code>${esc(f.entrada)}</code> · fichero <code>${esc(nombreDeFichero(f, version))}</code></p>
    <div class="cols">
      <div>
        <p class="rot">Pasos</p>
        <ol>${f.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
      </div>
      <div>
        <p class="rot">Tiene que verse</p>
        <ul>${f.seVe.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>
    </div>
    ${f.negativo ? `<p class="neg"><b>Y que falle:</b> ${esc(f.negativo)}</p>` : ""}
  </div>`).join("")}`;
};

const conNegativo = FLUJOS.filter((f) => f.negativo).length;

process.stdout.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Guion de grabación de evidencias</title><style>
@page { size:A4; margin:16mm 14mm; }
*{box-sizing:border-box} html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font:9.6pt/1.45 "Helvetica Neue",Helvetica,Arial,sans-serif;color:#1a1720}
.marca{display:inline-block;background:#C8106E;color:#fff;font-size:7pt;font-weight:800;
  letter-spacing:.1em;padding:4px 10px;border-radius:999px;text-transform:uppercase}
h1{font-size:21pt;line-height:1.12;font-weight:800;margin:11px 0 3px;letter-spacing:-.015em}
.sub{font-size:9.4pt;color:#6b6472;margin:0 0 13px;font-weight:500}
hr.regla{border:0;border-top:2px solid #1a1720;margin:0 0 14px}
h2{font-size:12pt;font-weight:800;color:#C8106E;margin:22px 0 8px;page-break-after:avoid}
h2 .n{font-size:8.4pt;color:#6b6472;font-weight:700}
.flujo{border-left:3px solid #ece9ef;padding:2px 0 2px 12px;margin:0 0 13px;page-break-inside:avoid}
.cab{margin:0 0 2px;font-weight:800;font-size:10.4pt}
.num{display:inline-grid;place-items:center;width:19px;height:19px;border-radius:999px;
  background:#1a1720;color:#fff;font-size:7.6pt;margin-right:5px;vertical-align:1px}
.cod{background:#fdf2f8;color:#C8106E;font-size:7.4pt;font-weight:800;padding:2px 7px;
  border-radius:999px;margin-left:4px}
.meta{margin:0 0 6px;font-size:8.2pt;color:#6b6472;font-weight:600}
code{background:#f4f2f6;padding:1px 4px;border-radius:3px;font-size:8pt}
.cols{display:grid;grid-template-columns:1.35fr 1fr;gap:14px}
.rot{margin:0 0 2px;font-size:7.2pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b6472}
ol,ul{margin:0;padding-left:16px} li{margin-bottom:2px}
.neg{margin:7px 0 0;background:#fffbeb;border-left:3px solid #d9a406;padding:6px 10px;
  border-radius:0 4px 4px 0;font-size:8.8pt}
.caja{background:#fdf2f8;border-left:3px solid #C8106E;padding:11px 14px;margin:11px 0 16px;
  border-radius:0 6px 6px 0;page-break-inside:avoid}
.caja .rot{color:#C8106E;margin-bottom:4px}
.caja p{margin:0 0 7px}.caja p:last-child{margin:0}
</style></head><body>
<span class="marca">Gnerai &times; Tardeos Club</span>
<h1>Guion de grabación de evidencias</h1>
<p class="sub">${FLUJOS.length} vídeos &middot; versión ${esc(version)} &middot; ${esc(entorno)} &middot; ${esc(hoy)}</p>
<hr class="regla">

<div class="caja">
  <span class="rot">Las dos reglas, que salen de vuestro apartado 4.2</span>
  <p><b>Cada flujo se graba con su rol, no con Admin.</b> Un admin lo puede todo, así que
  grabando con él no se demuestra ningún permiso. Vuestra lista de lo que no aceptáis como
  cierre incluye «una función probada únicamente con Admin»: por eso cada vídeo dice con qué
  cuenta se graba.</p>
  <p><b>Cada flujo lleva su caso negativo</b> — ${conNegativo} de los ${FLUJOS.length} lo tienen.
  Un vídeo donde todo sale bien no prueba que exista una comprobación: prueba que no hizo
  falta. Lo que demuestra que el permiso está es verlo denegar.</p>
  <p>El orden es por rol y no por código, porque cambiar de cuenta es lo más lento de grabar:
  se entra una vez con cada una y se graba todo lo suyo seguido.</p>
</div>

${ORDEN_DE_GRABACION.map(seccion).join("")}

<h2>Cómo se entrega</h2>
<p>Un fichero por flujo, con el nombre que aparece en cada ficha: rol, código, título y
versión. La versión va DENTRO del nombre porque sin ella, a los tres meses, nadie sabe si un
vídeo enseña lo que hay hoy o lo que había cuando se grabó — y eso es justo lo que os hace
falta para validar.</p>
<p>Este guion se genera desde el código (<code>lib/flujos.ts</code>), no se escribe a mano: si
mañana cambia un flujo, el guion sale al día sin que nadie se acuerde de actualizarlo.</p>
</body></html>
`);
