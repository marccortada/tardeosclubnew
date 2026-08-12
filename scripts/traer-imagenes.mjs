/**
 * Trae al proyecto nuevo las imágenes que todavía viven en el de la app
 * antigua, y reescribe las URLs de la base.
 *
 * La migración copió las FILAS pero no los FICHEROS: los flyers, los logos de
 * los locales y los avatares de los DJs siguen sirviéndose desde el proyecto
 * viejo. Funcionan hoy porque ese proyecto sigue encendido; el día que se
 * apague, la web se queda sin una sola imagen y los resultados de Google
 * también, que apuntan a las mismas URLs.
 *
 * Además el cron diario copia `image_url` tal cual desde la app antigua, así
 * que cada evento nuevo llega otra vez apuntando al proyecto viejo. Por eso
 * esto se ejecuta DESPUÉS de sincronizar, no una sola vez.
 *
 * Uso:
 *   node scripts/traer-imagenes.mjs              # solo mira y cuenta
 *   node scripts/traer-imagenes.mjs --escribir   # copia y actualiza
 *
 * Necesita .env.migracion (VIEJO_URL/VIEJO_SERVICE_KEY) y .env.local
 * (NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY), o las mismas por
 * variable de entorno.
 */
import fs from "node:fs";

const ESCRIBIR = process.argv.includes("--escribir");

// ---------- Configuración ----------
function cargar(fichero) {
  if (!fs.existsSync(fichero)) return {};
  const env = {};
  for (const linea of fs.readFileSync(fichero, "utf8").split("\n")) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
  }
  return env;
}

const local = { ...cargar(".env.local"), ...cargar(".env.migracion"), ...process.env };

const VIEJO_URL = (local.VIEJO_URL || "").replace(/\/$/, "");
const VIEJO_KEY = local.VIEJO_SERVICE_KEY || "";
const NUEVO_URL = (local.NEXT_PUBLIC_SUPABASE_URL || local.NUEVO_URL || "").replace(/\/$/, "");
const NUEVO_KEY = local.SUPABASE_SERVICE_ROLE_KEY || local.NUEVO_SERVICE_KEY || "";

// El bucket que ya existe y ya es público en el proyecto nuevo. Todo entra
// aquí bajo `migrados/<bucket de origen>/…` en vez de recrear los seis buckets
// del proyecto viejo.
const BUCKET = "flyers";
const PREFIJO = "migrados";

/** Dónde puede haber una URL del proyecto viejo. */
const CAMPOS = [
  { tabla: "tardeos", columna: "flyer_url" },
  { tabla: "locales", columna: "logo_url" },
  { tabla: "djs", columna: "avatar_url" },
];

// Las claves recortadas con "…" al copiarlas del panel revientan al construir
// la cabecera, y el error que sale no dice eso. Mejor avisar aquí.
for (const [nombre, valor] of Object.entries({ VIEJO_URL, VIEJO_SERVICE_KEY: VIEJO_KEY, NUEVO_URL, NUEVO_SERVICE_KEY: NUEVO_KEY })) {
  if (!valor) { console.error(`Falta ${nombre}.`); process.exit(1); }
  if (/[^\x20-\x7E]/.test(valor)) { console.error(`${nombre} tiene caracteres raros: ¿la copiaste recortada con "…"?`); process.exit(1); }
}

const cabViejo = { apikey: VIEJO_KEY, Authorization: `Bearer ${VIEJO_KEY}` };
const cabNuevo = { apikey: NUEVO_KEY, Authorization: `Bearer ${NUEVO_KEY}` };

const HOST_VIEJO = new URL(VIEJO_URL).host;

// ---------- Utilidades ----------
async function enLotes(items, n, fn) {
  const salida = [];
  for (let i = 0; i < items.length; i += n) {
    salida.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  }
  return salida;
}

const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * De la URL pública del proyecto viejo saca el bucket y la ruta dentro de él.
 * https://VIEJO/storage/v1/object/public/event-images/abc/1.jpg
 *   -> { bucket: "event-images", ruta: "abc/1.jpg" }
 */
function trocear(url) {
  const i = url.indexOf("/object/public/");
  if (i === -1) return null;
  const resto = url.slice(i + "/object/public/".length);
  const barra = resto.indexOf("/");
  if (barra === -1) return null;
  return { bucket: resto.slice(0, barra), ruta: decodeURIComponent(resto.slice(barra + 1)) };
}

function destinoDe(bucket, ruta) {
  return `${PREFIJO}/${bucket}/${ruta}`;
}

function urlNueva(destino) {
  // Cada tramo por separado: los nombres de fichero traen espacios y acentos.
  const codificada = destino.split("/").map(encodeURIComponent).join("/");
  return `${NUEVO_URL}/storage/v1/object/public/${BUCKET}/${codificada}`;
}

// ---------- Trabajo ----------
async function pendientes() {
  const lista = [];
  for (const { tabla, columna } of CAMPOS) {
    const r = await fetch(
      `${NUEVO_URL}/rest/v1/${tabla}?select=id,${columna}&${columna}=not.is.null`,
      { headers: cabNuevo }
    );
    if (!r.ok) throw new Error(`No se pudo leer ${tabla}: ${r.status} ${await r.text()}`);
    for (const fila of await r.json()) {
      const url = String(fila[columna]);
      if (!url.includes(HOST_VIEJO)) continue;
      const trozos = trocear(url);
      if (!trozos) { console.warn(`  ! URL con formato raro, se salta: ${url}`); continue; }
      lista.push({ tabla, columna, id: fila.id, url, ...trozos });
    }
  }
  return lista;
}

/** Reintenta cuando el almacenamiento responde 429 (demasiadas peticiones). */
async function conReintento(fn, intentos = 4) {
  for (let i = 0; ; i++) {
    const r = await fn();
    if (r.status !== 429 || i >= intentos) return r;
    await new Promise((s) => setTimeout(s, 400 * (i + 1)));
  }
}

/** ¿Ya está esa imagen en el proyecto nuevo? */
async function yaEsta(destino) {
  const r = await conReintento(() =>
    fetch(`${NUEVO_URL}/storage/v1/object/${BUCKET}/${destino.split("/").map(encodeURIComponent).join("/")}`, {
      method: "HEAD",
      headers: cabNuevo,
    })
  );
  return r.ok;
}

/**
 * Copia del viejo al nuevo (si hace falta) y devuelve la URL nueva.
 *
 * La comprobación de si ya existe no es un adorno: esto se ejecuta a diario
 * después de sincronizar, y la sincronización devuelve las URLs al origen cada
 * mañana. Sin ella se volverían a mover los mismos 277 MB todos los días, que
 * se come la cuota de tráfico del proyecto viejo en dos semanas.
 */
async function traer(item) {
  const destino = destinoDe(item.bucket, item.ruta);
  if (await yaEsta(destino)) return { url: urlNueva(destino), bytes: 0, reusada: true };

  // Las URLs son públicas, pero se manda la clave igualmente: así sigue
  // funcionando si algún bucket se cierra antes de que terminemos.
  const bajada = await conReintento(() => fetch(item.url, { headers: cabViejo }));
  // 400/404 = el fichero ya no está tampoco en el viejo, así que no hay nada
  // que rescatar. Se avisa arriba para dejar la columna a null en vez de
  // conservar un enlace muerto que además apunta al proyecto que se va a
  // apagar. La sincronización lo devolverá mañana y volveremos a limpiarlo:
  // lo que importa es que al terminar cada pasada no quede nada apuntando allí.
  if (bajada.status === 400 || bajada.status === 404) return { desaparecida: true };
  if (!bajada.ok) throw new Error(`descarga ${bajada.status}`);
  const bytes = Buffer.from(await bajada.arrayBuffer());
  const tipo = bajada.headers.get("content-type") || "application/octet-stream";

  const subida = await conReintento(() =>
    fetch(`${NUEVO_URL}/storage/v1/object/${BUCKET}/${destino.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { ...cabNuevo, "content-type": tipo, "x-upsert": "true" },
      body: bytes,
    })
  );
  if (!subida.ok) throw new Error(`subida ${subida.status} ${(await subida.text()).slice(0, 120)}`);

  return { url: urlNueva(destino), bytes: bytes.length, reusada: false };
}

async function apuntarFila(item, url) {
  const r = await fetch(`${NUEVO_URL}/rest/v1/${item.tabla}?id=eq.${item.id}`, {
    method: "PATCH",
    headers: { ...cabNuevo, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ [item.columna]: url }),
  });
  if (!r.ok) throw new Error(`actualizar fila ${r.status} ${(await r.text()).slice(0, 120)}`);
}

// ---------- Main ----------
console.log(`viejo: ${HOST_VIEJO}\nnuevo: ${new URL(NUEVO_URL).host}\nmodo:  ${ESCRIBIR ? "ESCRIBIR" : "solo mirar"}\n`);

const items = await pendientes();

if (items.length === 0) {
  console.log("No queda ninguna imagen en el proyecto viejo. Nada que hacer.");
  process.exit(0);
}

const porBucket = {};
for (const i of items) porBucket[i.bucket] = (porBucket[i.bucket] ?? 0) + 1;
console.log(`${items.length} imágenes por traer:`);
for (const [b, n] of Object.entries(porBucket)) console.log(`  ${b.padEnd(16)} ${n}`);

if (!ESCRIBIR) {
  // Se mide el peso antes de mover nada: si no cabe en el plan del proyecto
  // nuevo, mejor saberlo ahora que a mitad de la copia.
  console.log("\nMidiendo el peso (HEAD, no descarga)…");
  // De 8 en 8 y no más: el almacenamiento devuelve 429 si se le aprieta, y un
  // 429 se confundiría con "esta imagen no existe".
  const tam = await enLotes(items, 8, async (i) => {
    try {
      const r = await fetch(i.url, { method: "HEAD", headers: cabViejo });
      return r.ok ? Number(r.headers.get("content-length") || 0) : -1;
    } catch { return -1; }
  });
  const rotas = tam.filter((t) => t < 0).length;
  const total = tam.filter((t) => t > 0).reduce((a, b) => a + b, 0);
  console.log(`  peso total: ${mb(total)}   media: ${kb(total / Math.max(1, tam.length - rotas))}`);
  if (rotas) console.log(`  OJO: ${rotas} no se pueden descargar (ya rotas en el viejo); se saltarán.`);
  console.log(`\nNada escrito. Para hacerlo de verdad:  node scripts/traer-imagenes.mjs --escribir`);
  process.exit(0);
}

let hechas = 0, saltadas = 0, bytes = 0, reusadas = 0, perdidas = 0;
const fallos = [];

await enLotes(items, 6, async (item) => {
  try {
    const { url, bytes: n, reusada, desaparecida } = await traer(item);
    if (desaparecida) {
      await apuntarFila(item, null);
      perdidas++;
      return;
    }
    await apuntarFila(item, url);
    hechas++; bytes += n; if (reusada) reusadas++;
    if (hechas % 100 === 0) console.log(`  ${hechas}/${items.length} (${mb(bytes)} copiados)`);
  } catch (e) {
    // Una imagen que ya no existe en el viejo no puede rescatarse, pero no
    // debe parar a las otras 681.
    saltadas++;
    fallos.push(`${item.tabla}/${item.id}: ${e.message}`);
  }
});

console.log(
  `\nURLs corregidas ${hechas} · ficheros nuevos ${hechas - reusadas} (${mb(bytes)}) · ya estaban ${reusadas}` +
    ` · sin original en el viejo ${perdidas} (a null) · fallidas ${saltadas}`
);
if (fallos.length) {
  console.log("\nFallos:");
  for (const f of fallos.slice(0, 20)) console.log(`  · ${f}`);
  if (fallos.length > 20) console.log(`  … y ${fallos.length - 20} más`);
}

const quedan = await pendientes();
console.log(`\nquedan apuntando al proyecto viejo: ${quedan.length}`);
