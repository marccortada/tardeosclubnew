// Recuentos de la limpieza L1‑L7 en PRODUCCIÓN. SOLO LECTURA.
//
//   node --env-file=.env.local scripts/limpieza-recuentos.mjs
//
// Usa la service role SOLO para leer (select / head count). No escribe, no
// borra, no llama a ninguna función. Sirve para enseñar al cliente cuántas
// filas tocaría cada paso de supabase/limpieza/ antes de pedir el "sí".
// Además busca DJs duplicados por NOMBRE (no solo por origen_id): el caso
// "Fatima Kahlo" ×2 son dos fichas creadas a mano, no por la migración.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const db = createClient(URL, KEY, { auth: { persistSession: false } });

/** Todas las filas de una consulta, de 1.000 en 1.000 (tope de PostgREST). */
async function todas(tabla, cols, filtrar = (q) => q) {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await filtrar(db.from(tabla).select(cols)).order("id").range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
/** Cuántas filas de `tabla` tienen `col` en `ids` (por trozos, solo recuento). */
async function cuelgan(tabla, col, ids, extra = (q) => q) {
  let n = 0;
  for (let i = 0; i < ids.length; i += 150) {
    const { count, error } = await extra(db.from(tabla).select(col, { count: "exact", head: true }).in(col, ids.slice(i, i + 150)));
    if (error) return `no se pudo (${error.code ?? error.message})`;
    n += count ?? 0;
  }
  return n;
}
async function contar(tabla, filtrar) {
  const { count, error } = await filtrar(db.from(tabla).select("id", { count: "exact", head: true }));
  return error ? `no se pudo (${error.code ?? error.message})` : count;
}
/** Pares copia (sin origen_id) → gemelo bueno (origen_id = id de la copia). */
function pares(filas) {
  const porOrigen = new Set(filas.filter((f) => f.origen_id).map((f) => f.origen_id));
  return filas.filter((f) => !f.origen_id && porOrigen.has(f.id)).map((f) => f.id);
}
const plegar = (s) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim().replace(/^dj\s+/, "").replace(/\s+dj$/, "").trim();

const r = {};

// L1 · tardeos duplicados
const tardeos = await todas("tardeos", "id,origen_id,estado,fecha");
const dupT = pares(tardeos);
r.L1 = {
  tardeos_total: tardeos.length,
  duplicados_a_borrar: dupT.length,
  cuelgan_favoritos: await cuelgan("favoritos", "tardeo_id", dupT),
  cuelgan_inscripciones: await cuelgan("inscripciones", "tardeo_id", dupT),
  cuelgan_tardeo_djs: await cuelgan("tardeo_djs", "tardeo_id", dupT),
  cuelgan_eventos_metrica: await cuelgan("eventos_metrica", "tardeo_id", dupT),
};

// L2 · locales duplicados
const locales = await todas("locales", "id,origen_id,zona,destacado_orden");
const dupL = pares(locales);
r.L2 = {
  locales_total: locales.length,
  duplicados_a_borrar: dupL.length,
  cuelgan_tardeos: await cuelgan("tardeos", "local_id", dupL),
  cuelgan_eventos_metrica: await cuelgan("eventos_metrica", "local_id", dupL),
};

// L3 · DJs duplicados (por origen) + por nombre normalizado
const djs = await todas("djs", "id,origen_id,nombre_artistico,profile_id,oculto,destacado_orden");
const dupD = pares(djs);
r.L3 = {
  djs_total: djs.length,
  duplicados_por_origen_a_borrar: dupD.length,
  cuelgan_tardeo_djs: await cuelgan("tardeo_djs", "dj_id", dupD),
  cuelgan_eventos_metrica: await cuelgan("eventos_metrica", "dj_id", dupD),
};
const grupos = new Map();
for (const d of djs) {
  const k = plegar(d.nombre_artistico);
  if (!k) continue;
  grupos.set(k, [...(grupos.get(k) ?? []), d]);
}
const enOrigen = new Set(dupD);
// Mismo nombre y NO explicado ya por L3 (quitando las copias de la migración).
const porNombre = [...grupos.values()]
  .map((g) => g.filter((d) => !enOrigen.has(d.id)))
  .filter((g) => g.length > 1);
r.L3_por_nombre = {
  grupos_con_mismo_nombre: porNombre.length,
  fichas_implicadas: porNombre.reduce((n, g) => n + g.length, 0),
  detalle: porNombre.map((g) => g.map((d) => ({
    id: d.id, nombre: d.nombre_artistico, con_cuenta: !!d.profile_id, oculto: d.oculto,
  }))),
};

// L4 · perfiles sin cuenta de acceso que se vincularían por email al entrar
const perfiles = await todas("profiles", "id,email");
const usuarios = new Set();
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { r.L4 = { error: error.message }; break; }
  data.users.forEach((u) => usuarios.add(u.id));
  if (data.users.length < 1000) break;
}
if (!r.L4) {
  const fantasmas = perfiles.filter((p) => !usuarios.has(p.id));
  r.L4 = {
    perfiles_total: perfiles.length,
    con_cuenta: perfiles.length - fantasmas.length,
    fantasmas: fantasmas.length,
    fantasmas_con_email: fantasmas.filter((p) => p.email).length,
  };
}

// L5 · orden de destacados: se reinicia y se pone el de la web antigua
r.L5 = {
  locales_con_orden_hoy: locales.filter((l) => l.destacado_orden != null).length,
  djs_con_orden_hoy: djs.filter((d) => d.destacado_orden != null).length,
};

// L6 · grafías de zona que se unifican (mismas que el fichero L6)
const VARIANTES = ["BARCELONA", "Mataro", "barbera del valles", "Barbera del Valles", "REUS", "RIUDOMS"];
r.L6 = {};
for (const v of VARIANTES) {
  r.L6[v] = {
    tardeos: tardeos.length ? await contar("tardeos", (q) => q.eq("zona", v)) : 0,
    locales: locales.filter((l) => l.zona === v).length,
  };
}

// L7 · estados: publicados con fecha pasada → finalizado; uno concreto → cancelado
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
r.L7 = {
  publicados_pasados_a_finalizado: tardeos.filter((t) => t.estado === "publicado" && t.fecha < hoy).length,
  a_cancelar_por_origen: tardeos.filter((t) => t.origen_id === "24856ed5-cc33-4f2b-a3d2-e4de958632ed" && t.estado !== "cancelado").length,
};

console.log(JSON.stringify(r, null, 2));
console.log("\nSolo lectura: no se ha cambiado nada.");
