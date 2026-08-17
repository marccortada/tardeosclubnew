/**
 * Rellena `tardeos.tipo_evento` cuando el propio evento lo dice.
 *
 * Los 662 tardeos migrados llegaron sin este campo: la app antigua no lo tiene.
 * Sin él, el filtro de tipo de evento sale vacío sobre toda la cartelera.
 *
 * SOLO clasifica cuando la palabra está ESCRITA en el título o la descripción.
 * No se deduce de la hora a propósito: 170 de los migrados empiezan a partir de
 * las 20h, y por hora saldrían "Nocheo" en una app que se llama TardeosClub —
 * casi todos son tardeos que se alargan. Mejor sin tipo que con el tipo
 * equivocado, que en un filtro se nota enseguida.
 *
 * No pisa lo que ya tenga puesto un local a mano.
 *
 * Se puede ejecutar tantas veces como haga falta: la sincronización diaria trae
 * eventos nuevos, y como su upsert no incluye `tipo_evento`, lo que escriba esto
 * sobrevive a la pasada de la mañana.
 *
 * Uso:
 *   node scripts/clasificar-tipos.mjs              # solo cuenta
 *   node scripts/clasificar-tipos.mjs --escribir   # escribe
 */
import fs from "node:fs";

const ESCRIBIR = process.argv.includes("--escribir");

function cargar(f) {
  if (!fs.existsSync(f)) return {};
  const env = {};
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
  }
  return env;
}
const env = { ...cargar(".env.local"), ...process.env };
const URL_SB = (env.NEXT_PUBLIC_SUPABASE_URL || env.NUEVO_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NUEVO_SERVICE_KEY || "";
if (!URL_SB || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const norma = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * El orden importa: gana la primera que casa.
 *
 * "Coffee Rave" va antes que nada porque su nombre contiene "rave" y podría
 * confundirse; "Tardeo" va al final porque es la palabra más común y muchos
 * títulos la llevan junto a otra más específica ("Vermut tardeo", que es un
 * vermuteo).
 */
const REGLAS = [
  ["Coffee Rave", /coffee\s*rave/],
  ["Brunch", /brunch/],
  ["Vermuteo", /vermut|vermout/],
  ["After Work", /after\s*work|afterwork/],
  ["Festival", /festival/],
  ["Mañaneo", /mananeo|manianeo/],
  ["Nocheo", /nocheo/],
  ["Tardeo", /tardeo|tardeig/],
];

const filas = await (await fetch(
  `${URL_SB}/rest/v1/tardeos?select=id,titulo,descripcion,tipo_evento&limit=5000`,
  { headers: H }
)).json();

if (!Array.isArray(filas)) { console.error("No se pudo leer:", JSON.stringify(filas).slice(0, 200)); process.exit(1); }

const porHacer = [];
let yaTenian = 0, sinPista = 0;

for (const f of filas) {
  if (f.tipo_evento) { yaTenian++; continue; }   // lo puso alguien: no se toca
  const texto = `${norma(f.titulo)} ${norma(f.descripcion)}`;
  const regla = REGLAS.find(([, re]) => re.test(texto));
  if (!regla) { sinPista++; continue; }
  porHacer.push({ id: f.id, tipo: regla[0], titulo: f.titulo });
}

const cuenta = {};
for (const x of porHacer) cuenta[x.tipo] = (cuenta[x.tipo] ?? 0) + 1;

console.log(`${filas.length} tardeos · ya tenían tipo: ${yaTenian} · sin pista en el texto: ${sinPista}`);
console.log(`por clasificar: ${porHacer.length}`);
for (const [k, v] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}

if (!ESCRIBIR) {
  console.log("\nMuestra de lo que haría:");
  for (const x of porHacer.slice(0, 8)) console.log(`  ${x.tipo.padEnd(12)} <- "${(x.titulo || "").slice(0, 50)}"`);
  console.log("\nNada escrito. Para hacerlo:  node scripts/clasificar-tipos.mjs --escribir");
  process.exit(0);
}

// De 40 en 40: una sola petición con 383 ids es más frágil que varias cortas, y
// si algo falla se ve en qué lote fue.
let hechos = 0;
const fallos = [];
const porTipo = {};
for (const [tipo] of REGLAS) {
  const ids = porHacer.filter((x) => x.tipo === tipo).map((x) => x.id);
  for (let i = 0; i < ids.length; i += 40) {
    const trozo = ids.slice(i, i + 40);
    const r = await fetch(`${URL_SB}/rest/v1/tardeos?id=in.(${trozo.join(",")})`, {
      method: "PATCH",
      headers: { ...H, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ tipo_evento: tipo }),
    });
    if (r.ok) { hechos += trozo.length; porTipo[tipo] = (porTipo[tipo] ?? 0) + trozo.length; }
    else fallos.push(`${tipo} lote ${i / 40}: ${r.status} ${(await r.text()).slice(0, 100)}`);
  }
}

console.log(`\nescritos ${hechos} de ${porHacer.length}`);
for (const [k, v] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
if (fallos.length) { console.log("\nFallos:"); fallos.forEach((f) => console.log("  · " + f)); }

// Comprobación independiente: se vuelve a leer de la base.
const final = await (await fetch(`${URL_SB}/rest/v1/tardeos?select=tipo_evento&limit=5000`, { headers: H })).json();
const res = {};
for (const f of final) res[f.tipo_evento ?? "(sin tipo)"] = (res[f.tipo_evento ?? "(sin tipo)"] ?? 0) + 1;
console.log("\nComo queda la base:");
for (const [k, v] of Object.entries(res).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
