/**
 * Deduce la música habitual de cada local a partir de sus propios tardeos.
 *
 * Las recomendaciones por ADN se apoyan en el local cuando el tardeo no dice
 * nada, que es casi siempre: de los 780 tardeos de la cartelera, 752 traen
 * estilo musical y NINGUNO trae ambiente, público ni outfit. Pero el ADN del
 * local hay que rellenarlo a mano desde su panel, y hoy no lo ha hecho nadie:
 * los 68 locales lo tienen vacío. Con las dos partes vacías, el motor de
 * recomendaciones no tiene nada que comparar y no recomienda nada.
 *
 * Esto lo llena solo con lo que ya se sabe. Un local que ha hecho 26 tardeos de
 * House no necesita que nadie le escriba que pincha House.
 *
 * TRES CAUTELAS, y las tres importan:
 *
 * 1. No pisa lo que haya escrito un local. Este campo es suyo y lo edita desde
 *    su panel; deducirlo es una ayuda para el que no lo ha tocado, no una
 *    corrección para el que sí.
 * 2. Pide al menos 3 tardeos con estilo. Con uno o dos, lo que sale no es la
 *    música del sitio: es la música de una tarde.
 * 3. Descarta lo anecdótico. Un estilo entra si llega a la cuarta parte del
 *    dominante, para que un reggaeton suelto no acabe describiendo una sala de
 *    remember.
 *
 *    Relativo al dominante y no un porcentaje del total, que fue el primer
 *    intento y castigaba justo a los locales con más historia: con 349 tardeos,
 *    un 15 % son 53, y por ahí se caían Remember (24) y Techno (22) de un sitio
 *    que evidentemente pincha las dos cosas. La cola es más larga cuanto más
 *    grande es el local; medir contra el líder no depende del tamaño.
 *
 * Se guardan ETIQUETAS ("Deep House"), no ids, porque es lo que guarda el
 * formulario del local y lo que enseña su ficha.
 *
 * Uso:
 *   npx tsx scripts/adn-locales.mts              # solo enseña lo que haría
 *   npx tsx scripts/adn-locales.mts --escribir   # lo escribe
 */
import fs from "node:fs";
import { normalizarEstilo, valorGuardado, ESTILOS_TODOS, FAMILIAS } from "../lib/musica";

const ESCRIBIR = process.argv.includes("--escribir");
const MIN_TARDEOS = 3;
const PARTE_DEL_LIDER = 0.25;
const MAX_ESTILOS = 5;

function cargar(f: string): Record<string, string> {
  if (!fs.existsSync(f)) return {};
  const env: Record<string, string> = {};
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
  }
  return env;
}
const env = { ...cargar(".env.local"), ...process.env };
const URL_SB = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL_SB || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

/** El id normalizado, de vuelta a la etiqueta que guarda el formulario. */
function etiquetaGuardable(id: string): string | null {
  if (id.includes(":")) {
    const e = ESTILOS_TODOS.find((x) => x.id === id);
    return e ? valorGuardado(e.familia, e.etiqueta) : null;
  }
  // Un id sin ":" es una familia entera. Se guarda con su nombre: el tardeo
  // decía "Electrónica" a secas y eso es exactamente lo que se sabe del sitio.
  return FAMILIAS.find((f) => f.id === id)?.nombre ?? null;
}

const pedir = async (ruta: string) => {
  const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, { headers: H });
  if (!r.ok) { console.error(`${ruta} -> ${r.status} ${await r.text()}`); process.exit(1); }
  return r.json();
};

const locales = await pedir("locales?select=id,nombre,musica&limit=500");
const tardeos = await pedir("tardeos?select=local_id,estilo&estilo=not.is.null&limit=5000");

const senales = new Map<string, { total: number; cuenta: Map<string, number> }>();
for (const t of tardeos as { local_id: string | null; estilo: string }[]) {
  if (!t.local_id) continue;
  const ids = normalizarEstilo(t.estilo);
  if (!ids.length) continue;
  const s = senales.get(t.local_id) ?? { total: 0, cuenta: new Map<string, number>() };
  s.total++;
  // Un tardeo cuenta UNA vez por estilo aunque repita: "House + Deep House"
  // no son dos votos a House.
  for (const id of new Set(ids)) s.cuenta.set(id, (s.cuenta.get(id) ?? 0) + 1);
  senales.set(t.local_id, s);
}

let propuestos = 0, saltados = 0, escritos = 0;
for (const l of locales as { id: string; nombre: string; musica: string[] | null }[]) {
  if (l.musica?.length) { saltados++; continue; }
  const s = senales.get(l.id);
  if (!s || s.total < MIN_TARDEOS) continue;

  const lider = Math.max(...s.cuenta.values());
  const minimo = Math.max(2, Math.ceil(lider * PARTE_DEL_LIDER));
  const elegidos = [...s.cuenta]
    .filter(([, n]) => n >= minimo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ESTILOS)
    .map(([id, n]) => ({ etiqueta: etiquetaGuardable(id), n }))
    .filter((x): x is { etiqueta: string; n: number } => x.etiqueta !== null);
  if (!elegidos.length) continue;

  propuestos++;
  console.log(
    `  ${l.nombre.slice(0, 28).padEnd(29)} ${String(s.total).padStart(3)} tardeos -> ` +
    elegidos.map((e) => `${e.etiqueta} (${e.n})`).join(", ")
  );

  if (ESCRIBIR) {
    const r = await fetch(`${URL_SB}/rest/v1/locales?id=eq.${l.id}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify({ musica: elegidos.map((e) => e.etiqueta) }),
    });
    const filas = r.ok ? await r.json() : null;
    // Se comprueba que haya vuelto la fila, no que el código sea 200: con RLS,
    // un update que no alcanza nada devuelve 200 y cero filas, y darlo por
    // bueno es cómo se acaba creyendo que se ha escrito algo que no está.
    if (!r.ok || !filas?.length) console.log(`     NO se escribió (${r.status})`);
    else escritos++;
  }
}

console.log(`\n  ${propuestos} locales con música deducible · ${saltados} ya la tienen puesta` +
  (ESCRIBIR ? ` · ${escritos} escritos` : "  (nada escrito: falta --escribir)"));
