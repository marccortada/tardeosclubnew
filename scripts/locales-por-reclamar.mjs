/**
 * Quién no puede publicar todavía, y a quién hay que llamar primero.
 *
 * EL DATO QUE MOTIVA ESTO: de los 66 locales, 63 no han reclamado su ficha.
 * Sin reclamarla no tienen cuenta, y sin cuenta no pueden entrar a publicar
 * NADA. La cartelera no está vacía porque los locales no publiquen: está
 * vacía porque no tienen por dónde.
 *
 * Y 46 de ellos traen historial de la app vieja —el primero, 386 tardeos—,
 * así que no son fichas inventadas: son negocios que publicaban de verdad y
 * que aquí no han llegado a entrar.
 *
 * Se ordena por historial porque es el mejor indicio que tenemos de quién va a
 * volver a publicar. Quien montó 386 tardeos el año pasado no ha dejado de
 * hacer tardeos: ha dejado de anunciarlos aquí.
 *
 * USA LA CLAVE DE SERVIDOR. El email de los locales no es público desde el
 * lote 14 —se cosechaban los 59 en una sola petición— y para escribirles hace
 * falta. Sale de .env.local, no se imprime, y los ficheros se quedan en este
 * ordenador.
 *
 *   node scripts/locales-por-reclamar.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));

if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

const [{ data: locales }, { data: tardeos }] = await Promise.all([
  db.from("locales").select("id,nombre,zona,tipo,telefono,email,redes,owner_id"),
  db.from("tardeos").select("local_id,fecha,estado"),
]);

const act = new Map();
for (const t of tardeos) {
  const x = act.get(t.local_id) ?? { historial: 0, ultimo: null, futuros: 0 };
  if (t.estado === "finalizado" || t.estado === "publicado") {
    x.historial++;
    if (!x.ultimo || t.fecha > x.ultimo) x.ultimo = t.fecha;
  }
  if (t.estado === "publicado" && t.fecha >= hoy) x.futuros++;
  act.set(t.local_id, x);
}

const filas = locales.map((l) => {
  const a = act.get(l.id) ?? { historial: 0, ultimo: null, futuros: 0 };
  const r = l.redes ?? {};
  return {
    nombre: l.nombre, zona: l.zona || "", tipo: l.tipo === "promotor" ? "Promotor" : "Local",
    reclamado: l.owner_id ? "sí" : "no",
    telefono: l.telefono || "", email: l.email || "", instagram: r.instagram || "",
    historial: a.historial, ultimo: a.ultimo || "", futuros: a.futuros,
  };
})
// Sin contacto no se puede hacer nada con ellos, así que van al final.
.sort((a, b) =>
  (b.telefono || b.email ? 1 : 0) - (a.telefono || a.email ? 1 : 0) ||
  b.historial - a.historial ||
  a.nombre.localeCompare(b.nombre, "es"));

const cab = ["nombre","zona","tipo","reclamado","telefono","email","instagram","historial","ultimo","futuros"];
const csv = [cab.join(";")].concat(
  filas.map((f) => cab.map((k) => {
    const v = String(f[k] ?? "");
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(";"))
).join("\n");
fs.writeFileSync("/tmp/locales-por-reclamar.csv", "﻿" + csv);   // BOM para que Excel respete los acentos

const sinReclamar = filas.filter((f) => f.reclamado === "no");
console.log(`locales: ${filas.length}`);
console.log(`  sin reclamar: ${sinReclamar.length} (no pueden publicar)`);
console.log(`  de ellos, con contacto: ${sinReclamar.filter((f) => f.telefono || f.email).length}`);
console.log(`  de ellos, con historial: ${sinReclamar.filter((f) => f.historial > 0).length}`);
console.log("→ /tmp/locales-por-reclamar.csv");
