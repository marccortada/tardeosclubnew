#!/usr/bin/env node
/**
 * Migración de la app vieja (venues/djs/events) a la nueva (locales/djs/tardeos).
 *
 *   node scripts/migrar.mjs              # ensayo: no escribe nada
 *   node scripts/migrar.mjs --escribir   # escribe de verdad
 *
 * Necesita el Lote 11 aplicado en la base nueva (columna origen_id), que es lo
 * que hace que repetir la ejecución actualice en vez de duplicar.
 *
 * Variables de entorno (en .env.migracion, NO en el repo):
 *   VIEJO_URL, VIEJO_SERVICE_KEY, NUEVO_URL, NUEVO_SERVICE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// --- Configuración -------------------------------------------------------

// Nominatim pide identificarse. Pon un contacto real tuyo.
const USER_AGENT = "TardeosClub-migracion/1.0 (info@gnerai.com)";

// Cómo se traduce el `status` de la app vieja. Los valores reales los descubre
// el diagnóstico de abajo; lo que no esté aquí se trata como DESCONOCIDO y va a
// la opción prudente (borrador / oculto), nunca a publicado por accidente.
const ESTADO_LOCAL = {
  active: "activo", approved: "activo", published: "activo",
  incomplete: "borrador", pending: "borrador", draft: "borrador", rejected: "borrador",
  suspended: "oculto_impago",
};
const ESTADO_LOCAL_POR_DEFECTO = "borrador";

// Un DJ que no está aprobado en origen entra oculto: la ficha existe, pero no
// se enseña hasta que alguien la repase.
const DJ_APROBADO = new Set(["approved", "active", "published"]);

// Estados de evento que en la app vieja significan "no se ve". No basta con
// mirar la fecha: un evento futuro marcado inactive lo tenían escondido a
// propósito, y publicarlo aquí sería sacarlo a la luz sin permiso.
const STATUS_CANCELADO = new Set(["cancelled", "canceled", "cancelado", "rejected"]);
const STATUS_OCULTO = new Set(["inactive", "draft", "pending", "hidden"]);

// price_mode del origen -> cómo se cuenta la entrada aquí.
// 'hidden' es el caso peliagudo: son 286 y no sabemos el precio. Marcarlos
// gratis sería mentir a quien se plante en la puerta con cero euros, así que
// van como de pago sin importe, que en la tarjeta sale como "Entrada" a secas.
const ENTRADA = {
  paid:   { es_de_pago: true,  tiene_lista: false, conPrecio: true },
  free:   { es_de_pago: false, tiene_lista: false, conPrecio: false },
  list:   { es_de_pago: false, tiene_lista: true,  conPrecio: false },
  hidden: { es_de_pago: true,  tiene_lista: false, conPrecio: false },
};
const ENTRADA_POR_DEFECTO = ENTRADA.hidden;

const escribir = process.argv.includes("--escribir");
const LOTE = 100;

// --- Utilidades ----------------------------------------------------------

function env() {
  // Cargamos .env.migracion a mano para no meter otra dependencia.
  try {
    for (const linea of readFileSync(".env.migracion", "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* si no existe, se usan las del sistema */ }

  const faltan = ["VIEJO_URL", "VIEJO_SERVICE_KEY", "NUEVO_URL", "NUEVO_SERVICE_KEY"]
    .filter((k) => !process.env[k]);
  if (faltan.length) {
    console.error(`Faltan variables: ${faltan.join(", ")}`);
    console.error("Ponlas en .env.migracion (mira la cabecera de este fichero).");
    process.exit(1);
  }

  // Las claves viajan en cabeceras HTTP, que solo admiten Latin-1. Una clave
  // recortada con "…" revienta al primer insert, y para entonces ya te has
  // comido el minuto de geocodificación. Mejor cazarlo aquí.
  for (const k of ["VIEJO_SERVICE_KEY", "NUEVO_SERVICE_KEY"]) {
    const v = process.env[k];
    const raro = [...v].findIndex((c) => c.codePointAt(0) > 255);
    if (raro >= 0) {
      console.error(`${k} tiene un carácter no válido en la posición ${raro}: ${JSON.stringify(v[raro])}`);
      console.error("Parece una clave recortada. Copia la service_role entera desde");
      console.error("Supabase → Project Settings → API.");
      process.exit(1);
    }
    if (v.split(".").length !== 3) {
      console.error(`${k} no parece un JWT (deberían ser tres partes separadas por puntos).`);
      process.exit(1);
    }
  }
  return process.env;
}

const norm = (s) =>
  (s ?? "").toString().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * UUID determinista a partir de un texto. Los locales que sacamos de
 * `events.location_name` no tienen id propio en el origen, y necesitan uno
 * estable en `origen_id` o cada pasada del script los duplicaría.
 */
function uuidDe(clave) {
  const h = createHash("sha1").update(clave).digest("hex");
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** timestamptz -> fecha y hora tal y como se viven en España. */
function enMadrid(iso) {
  if (!iso) return { fecha: null, hora: null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { fecha: null, hora: null };
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const hora = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return { fecha, hora };
}

/** Nominatim, de uno en uno: su política pública es 1 consulta por segundo. */
async function geocodificar(texto) {
  if (!texto?.trim()) return null;
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=es&q="
    + encodeURIComponent(texto);
  try {
    const r = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" } });
    if (!r.ok) return null;
    const j = await r.json();
    const x = j?.[0];
    return x ? { lat: +x.lat, lng: +x.lon } : null;
  } catch {
    return null;
  } finally {
    await dormir(1100);
  }
}

async function insertar(cliente, tabla, filas) {
  if (!escribir || !filas.length) return { escritas: 0, error: null };
  let escritas = 0;
  for (let i = 0; i < filas.length; i += LOTE) {
    const trozo = filas.slice(i, i + LOTE);
    const { error } = await cliente.from(tabla).upsert(trozo, { onConflict: "origen_id" });
    if (error) return { escritas, error };
    escritas += trozo.length;
  }
  return { escritas, error: null };
}

const cuenta = (filas, campo) => {
  const m = new Map();
  for (const f of filas) m.set(f[campo] ?? "(null)", (m.get(f[campo] ?? "(null)") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

// --- Migración -----------------------------------------------------------

async function main() {
  const e = env();
  const viejo = createClient(e.VIEJO_URL, e.VIEJO_SERVICE_KEY, { auth: { persistSession: false } });
  const nuevo = createClient(e.NUEVO_URL, e.NUEVO_SERVICE_KEY, { auth: { persistSession: false } });

  console.log(escribir ? "\n=== MIGRACIÓN REAL ===\n" : "\n=== ENSAYO (no se escribe nada) ===\n");

  const [{ data: venues }, { data: djsV }, { data: events }] = await Promise.all([
    viejo.from("venues").select("*"),
    viejo.from("djs").select("*"),
    viejo.from("events").select("*"),
  ]);
  if (!venues || !djsV || !events) { console.error("No se pudo leer la base vieja."); process.exit(1); }

  // --- Diagnóstico: esto responde a lo que no sabíamos del origen ---------
  console.log(`Origen: ${venues.length} venues · ${djsV.length} djs · ${events.length} events\n`);
  console.log("venues.status  :", cuenta(venues, "status").map(([v, n]) => `${v}=${n}`).join("  "));
  console.log("djs.status     :", cuenta(djsV, "status").map(([v, n]) => `${v}=${n}`).join("  "));
  console.log("events.status  :", cuenta(events, "status").map(([v, n]) => `${v}=${n}`).join("  "));
  console.log("events.price_mode:", cuenta(events, "price_mode").map(([v, n]) => `${v}=${n}`).join("  "));

  const sinCoordVenue = venues.filter((v) => v.latitude == null || v.longitude == null);
  const sinLocal = events.filter((v) => !v.venue_id);
  const nombreDistinto = venues.filter((v) => v.name && v.venue_name && v.name !== v.venue_name);
  console.log(`\nvenues sin coordenadas : ${sinCoordVenue.length}`);
  console.log(`venues con name != venue_name: ${nombreDistinto.length}`);
  console.log(`events sin venue_id    : ${sinLocal.length}  <- no se pueden importar`);
  console.log(`events sin coordenadas : ${events.filter((v) => v.location_lat == null).length}`);

  // ¿Con qué contacto nos quedamos para mandar las invitaciones? Los perfiles
  // se leen SOLO para contar: no se copia ningún email personal a la base nueva.
  const { data: perfilesViejos } = await viejo.from("profiles").select("id,email");
  const emailCuenta = new Map((perfilesViejos ?? []).map((p) => [p.id, p.email]));
  const conEmail = venues.filter((v) => v.email?.trim()).length;
  const soloCuenta = venues.filter((v) => !v.email?.trim() && emailCuenta.get(v.user_id)).length;
  console.log(`\nvenues con email propio: ${conEmail} · con teléfono: ${venues.filter((v) => v.phone?.trim()).length}`);
  console.log(`venues sin email propio pero con email de cuenta: ${soloCuenta} (no se migran: son datos personales)`);

  const desconocidos = [...new Set(venues.map((v) => v.status).filter((s) => s && !(s in ESTADO_LOCAL)))];
  if (desconocidos.length) {
    console.log(`\n⚠ status de venue sin mapear (irán a '${ESTADO_LOCAL_POR_DEFECTO}'): ${desconocidos.join(", ")}`);
  }

  // --- Locales paraguas ---------------------------------------------------
  // En la app vieja hay "venues" que no son un local sino un evento colgando de
  // varios sitios a la vez: el del eclipse tenía 18 tardeos en 18 pueblos. Si
  // los migramos tal cual, las 18 tarjetas ponen "ECLIPSE SOLAR 12/08/2026"
  // donde debería ir el nombre del bar.
  //
  // La señal para distinguirlos es geográfica y no falla: un local de verdad
  // tiene sus eventos en una ciudad; un paraguas, en varias. Para esos, el
  // sitio real está en events.location_name, y de ahí sacamos un local propio.
  const ciudadesPorVenue = new Map();
  for (const ev of events) {
    if (!ev.venue_id || !ev.location_city) continue;
    const s = ciudadesPorVenue.get(ev.venue_id) ?? new Set();
    s.add(norm(ev.location_city));
    ciudadesPorVenue.set(ev.venue_id, s);
  }
  const paraguas = new Set(
    [...ciudadesPorVenue].filter(([, s]) => s.size > 1).map(([id]) => id)
  );

  if (paraguas.size) {
    console.log(`\nvenues que son paraguas (eventos en varias ciudades): ${paraguas.size}`);
    for (const id of paraguas) {
      const v = venues.find((x) => x.id === id);
      const suyos = events.filter((e) => e.venue_id === id);
      const nombreVenue = (v?.venue_name || v?.name || "?").trim();
      const propios = suyos.filter((e) => e.location_name?.trim() && norm(e.location_name) !== norm(nombreVenue));
      console.log(`  · ${nombreVenue}  (${suyos.length} eventos, ${propios.length} con location_name propio)`);
      for (const e of suyos.slice(0, 3)) {
        console.log(`      location_name="${e.location_name ?? ""}" · ciudad="${e.location_city ?? ""}" · dir="${(e.location_address ?? "").slice(0, 45)}"`);
      }
    }
  }

  // --- 1) LOCALES ---------------------------------------------------------
  console.log("\n--- Locales ---");
  const vistos = new Map();          // clave nombre+dirección -> id viejo que ganó
  const mapaLocal = new Map();       // id viejo -> id viejo canónico (tras deduplicar)
  const filasLocal = [];
  let geocodificados = 0, sinGeo = 0;

  for (const v of venues) {
    const nombre = (v.venue_name || v.name || "").trim();
    if (!nombre) continue;
    const clave = `${norm(nombre)}|${norm(v.address)}`;
    if (vistos.has(clave)) { mapaLocal.set(v.id, vistos.get(clave)); continue; }
    vistos.set(clave, v.id);
    mapaLocal.set(v.id, v.id);

    let lat = v.latitude, lng = v.longitude;
    if (lat == null || lng == null) {
      const dir = [v.address, v.city].filter(Boolean).join(", ");
      const g = escribir ? await geocodificar(dir) : null;
      if (g) { lat = g.lat; lng = g.lng; geocodificados++; } else { sinGeo++; }
    }

    const redes = {};
    for (const [k, val] of [["instagram", v.instagram_url || v.instagram], ["facebook", v.facebook],
                            ["tiktok", v.tiktok_url || v.tiktok], ["web", v.website]]) {
      if (val) redes[k] = val;
    }

    filasLocal.push({
      origen_id: v.id,
      owner_id: null,                                   // los usuarios viejos no existen aquí
      nombre,
      descripcion: v.description || v.short_desc || null,
      direccion: v.address || null,
      lat, lng,
      zona: v.city || null,
      telefono: v.phone || null,
      // El de contacto del local, no el de la cuenta de quien lo registró.
      email: v.email || null,
      logo_url: v.logo_url || null,
      // Los paraguas son promotores: organizan sin local fijo y cada evento
      // suyo lleva su propia dirección.
      tipo: paraguas.has(v.id) ? "promotor" : "local",
      redes,
      estado: ESTADO_LOCAL[v.status] ?? ESTADO_LOCAL_POR_DEFECTO,
    });
  }
  // Índice de los locales que YA existen, por nombre normalizado. Sin esto, un
  // bar registrado en `venues` que además aparezca como location_name de un
  // evento del promotor entraría dos veces.
  const porNombre = new Map(filasLocal.map((l) => [norm(l.nombre), l.origen_id]));

  // A qué local va cada evento. Se decide una vez aquí y lo usa todo lo demás.
  const localPorEvento = new Map();
  const sitios = new Map();
  let reutilizados = 0;

  for (const ev of events) {
    if (!ev.venue_id) continue;

    // Local normal (o paraguas sin nombre de sitio: no hay nada que partir).
    if (!paraguas.has(ev.venue_id) || !ev.location_name?.trim()) {
      localPorEvento.set(ev.id, mapaLocal.get(ev.venue_id) ?? ev.venue_id);
      continue;
    }

    // ¿El sitio ya está dado de alta como local? Entonces se reaprovecha.
    const existente = porNombre.get(norm(ev.location_name));
    if (existente) {
      localPorEvento.set(ev.id, existente);
      reutilizados++;
      continue;
    }

    const id = uuidDe(`sitio:${norm(ev.location_name)}|${norm(ev.location_city)}`);
    localPorEvento.set(ev.id, id);
    if (sitios.has(id)) continue;
    const padre = venues.find((v) => v.id === ev.venue_id);
    let lat = ev.location_lat != null ? Number(ev.location_lat) : null;
    let lng = ev.location_lng != null ? Number(ev.location_lng) : null;
    if (lat == null || lng == null) {
      const g = escribir ? await geocodificar([ev.location_address, ev.location_city].filter(Boolean).join(", ")) : null;
      if (g) { lat = g.lat; lng = g.lng; geocodificados++; } else { sinGeo++; }
    }
    sitios.set(id, {
      origen_id: id,
      owner_id: null,
      nombre: ev.location_name.trim(),
      descripcion: null,
      direccion: ev.location_address || null,
      lat, lng,
      zona: ev.location_city || null,
      telefono: null,
      email: null,
      logo_url: null,
      // Un sitio partido de un paraguas ES un local: tiene dirección propia
      // y fija, que es lo que lo distingue del promotor que lo usa.
      //
      // Va explícito aunque la columna tenga default: el upsert se manda en
      // bloque y PostgREST rellena con NULL —no con el default— las claves
      // que unas filas traen y otras no. `tipo` es NOT NULL, así que esto
      // reventaba la sincronización entera, y con ella los tardeos.
      tipo: "local",
      redes: {},
      estado: ESTADO_LOCAL[padre?.status] ?? ESTADO_LOCAL_POR_DEFECTO,
    });
    // Que el siguiente evento en el mismo sitio lo encuentre y no lo repita.
    porNombre.set(norm(ev.location_name), id);
  }
  filasLocal.push(...sitios.values());

  // El paraguas en sí sobra si ya no le cuelga ningún evento: sería un local
  // fantasma en el mapa y en el listado.
  const usados = new Set(localPorEvento.values());
  const antes = filasLocal.length;
  const filtradas = filasLocal.filter((l) => !paraguas.has(l.origen_id) || usados.has(l.origen_id));
  filasLocal.length = 0;
  filasLocal.push(...filtradas);

  if (sitios.size || reutilizados) {
    console.log(`sitios reaprovechados de un local ya existente: ${reutilizados} eventos`);
    console.log(`locales nuevos sacados de events.location_name: ${sitios.size}`);
    console.log(`paraguas descartados por quedarse vacíos: ${antes - filasLocal.length}`);
  }
  console.log(`${filasLocal.length} a importar · ${venues.length - filasLocal.length + sitios.size} duplicados o descartados`);
  console.log(`con email: ${filasLocal.filter((l) => l.email).length} · con teléfono: ${filasLocal.filter((l) => l.telefono).length}`);
  if (escribir) console.log(`geocodificados: ${geocodificados} · sin conseguir: ${sinGeo}`);
  else if (sinCoordVenue.length) console.log(`(en la pasada real habría que geocodificar ${sinCoordVenue.length}, ~${Math.ceil(sinCoordVenue.length * 1.1)}s)`);

  const rLocal = await insertar(nuevo, "locales", filasLocal);
  if (rLocal.error) { console.error("Error escribiendo locales:", rLocal.error.message); process.exit(1); }
  if (escribir) console.log(`escritos: ${rLocal.escritas}`);

  // Necesitamos el id NUEVO de cada local para enganchar los tardeos.
  const idNuevoLocal = new Map();
  if (escribir) {
    const { data } = await nuevo.from("locales").select("id,origen_id").not("origen_id", "is", null);
    (data ?? []).forEach((l) => idNuevoLocal.set(l.origen_id, l.id));
  }

  // --- 2) DJS -------------------------------------------------------------
  console.log("\n--- DJs ---");
  const filasDj = [];
  const vistosDj = new Set();
  for (const d of djsV) {
    const nombre = (d.artist_name || "").trim();
    if (!nombre || vistosDj.has(norm(nombre))) continue;
    vistosDj.add(norm(nombre));
    const estilos = Array.isArray(d.styles) && d.styles.length ? d.styles : (d.genre ? [d.genre] : []);
    filasDj.push({
      origen_id: d.id,
      profile_id: null,
      nombre_artistico: nombre,
      bio: d.bio || d.bio_corta || null,
      estilos,
      avatar_url: d.avatar_url || null,
      oculto: !DJ_APROBADO.has(d.status),
      // reputacion_score NO se toca: la calcula el trigger del Lote 7 y la
      // protege el Lote 9. Escribirla a mano no serviría de nada.
    });
  }
  console.log(`${filasDj.length} a importar · ${djsV.length - filasDj.length} duplicados descartados`);
  const rDj = await insertar(nuevo, "djs", filasDj);
  if (rDj.error) { console.error("Error escribiendo djs:", rDj.error.message); process.exit(1); }
  if (escribir) console.log(`escritos: ${rDj.escritas}`);

  const idNuevoDj = new Map();
  if (escribir) {
    const { data } = await nuevo.from("djs").select("id,origen_id").not("origen_id", "is", null);
    (data ?? []).forEach((d) => idNuevoDj.set(d.origen_id, d.id));
  }

  // --- 3) TARDEOS ---------------------------------------------------------
  console.log("\n--- Tardeos ---");
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const filasTardeo = [];
  let sinFecha = 0, descartadosSinLocal = 0;

  for (const ev of events) {
    if (!ev.venue_id) { descartadosSinLocal++; continue; }
    const { fecha, hora } = enMadrid(ev.start_time);
    if (!fecha) { sinFecha++; continue; }

    // El local de cada evento se decidió arriba: el suyo, uno ya existente que
    // coincidía por nombre, o uno sacado de location_name.
    const localNuevo = idNuevoLocal.get(localPorEvento.get(ev.id));
    if (escribir && !localNuevo) { descartadosSinLocal++; continue; }

    const precio = ev.price != null ? Number(ev.price) : null;
    const ent = ENTRADA[ev.price_mode] ?? ENTRADA_POR_DEFECTO;

    // Lo pasado es historial y no se enseña en ningún listado. De lo futuro,
    // solo sale a la luz lo que ya estaba visible en la app vieja.
    const estado = STATUS_CANCELADO.has(ev.status) ? "cancelado"
      : fecha < hoy ? "finalizado"
      : STATUS_OCULTO.has(ev.status) ? "borrador"
      : "publicado";

    filasTardeo.push({
      origen_id: ev.id,
      local_id: localNuevo ?? null,
      titulo: (ev.title || "Tardeo").trim(),
      descripcion: ev.description || null,
      fecha,
      hora_inicio: hora,
      hora_fin: enMadrid(ev.end_time).hora,
      direccion: ev.location_address || null,
      lat: ev.location_lat != null ? Number(ev.location_lat) : null,
      lng: ev.location_lng != null ? Number(ev.location_lng) : null,
      zona: ev.location_city || null,
      estilo: (Array.isArray(ev.estilo_musical) && ev.estilo_musical[0])
        || (Array.isArray(ev.music_types) && ev.music_types[0]) || null,
      flyer_url: ev.image_url || null,
      es_de_pago: ent.es_de_pago,
      tiene_lista: ent.tiene_lista,
      precio: ent.conPrecio && precio && precio > 0 ? precio : null,
      fourvenues_url: ev.ticket_link || ev.promo_link || null,
      estado,
    });
  }

  const porEstado = cuenta(filasTardeo, "estado").map(([v, n]) => `${v}=${n}`).join("  ");
  console.log(`${filasTardeo.length} a importar (${porEstado})`);
  console.log(`entrada: ${cuenta(filasTardeo, "es_de_pago").map(([v, n]) => `pago=${v}:${n}`).join("  ")}`);
  console.log(`descartados sin local: ${descartadosSinLocal} · sin fecha válida: ${sinFecha}`);

  if (!escribir && sinLocal.length) {
    console.log("\nEventos sin local (se quedan fuera; míralos por si alguno importa):");
    for (const ev of sinLocal.slice(0, 25)) {
      console.log(`  · ${enMadrid(ev.start_time).fecha ?? "sin fecha"}  ${ev.title ?? "(sin título)"}`);
    }
  }

  const rT = await insertar(nuevo, "tardeos", filasTardeo);
  if (rT.error) { console.error("Error escribiendo tardeos:", rT.error.message); process.exit(1); }
  if (escribir) console.log(`escritos: ${rT.escritas}`);

  // --- 4) DJs de cada tardeo ---------------------------------------------
  if (escribir) {
    const { data: tardeosNuevos } = await nuevo.from("tardeos").select("id,origen_id").not("origen_id", "is", null);
    const idNuevoTardeo = new Map((tardeosNuevos ?? []).map((t) => [t.origen_id, t.id]));
    const enlaces = [];
    for (const ev of events) {
      const t = idNuevoTardeo.get(ev.id);
      if (!t) continue;
      const djs = [ev.dj_id, ...(Array.isArray(ev.co_dj_ids) ? ev.co_dj_ids : [])].filter(Boolean);
      for (const d of djs) {
        const dn = idNuevoDj.get(d);
        if (dn) enlaces.push({ tardeo_id: t, dj_id: dn });
      }
    }
    console.log(`\n--- Tardeo-DJ ---\n${enlaces.length} enlaces`);
    for (let i = 0; i < enlaces.length; i += LOTE) {
      const { error } = await nuevo.from("tardeo_djs").upsert(enlaces.slice(i, i + LOTE), { ignoreDuplicates: true });
      if (error) { console.error("Error enlazando djs:", error.message); break; }
    }
  }

  console.log(escribir
    ? "\nHecho. Revisa /admin/locales y /tardeos antes de dar por buena la migración."
    : "\nEnsayo terminado. Repasa los números y, si cuadran: node scripts/migrar.mjs --escribir");
}

main().catch((e) => { console.error(e); process.exit(1); });
