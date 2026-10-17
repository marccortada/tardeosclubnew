import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { secretoCronValido, endpointPushPermitido } from "@/lib/apiAuth";
import { registrar } from "@/lib/registro";
import {
  faseDebida, minutosHastaInicio, elegirPropuesta, textoUnaHora, textoFin, textoCambio, textoCancelacion,
  instantesTardeo, ESPERA_CAMBIO_MS, ESPERA_CANCELACION_MS, type SetPropuesta, type TextoAviso,
} from "@/lib/avisos";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron de avisos programados (dossier 2.0 pág. 10). Ejecutar CADA 10 MINUTOS:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<dominio>/api/avisos
 *
 *  a) 1 h antes del inicio, a "Asistiré" (y a guardados si el ajuste
 *     `avisos_1h_guardados` = 'true'): "Tu plan empieza en 1 h" + propuesta
 *     musical (set favorito → set del cartel → nada; nunca suena solo).
 *  b) Al terminar (hora de fin): "¿Qué tal ha ido?" + encuesta + vuelta segura,
 *     en UN aviso.
 *  c) Cambio de fecha/hora (10 min de margen para que el local corrija erratas)
 *     o cancelación (30 min de margen: si el local pulsa "Avisar a los
 *     apuntados" — /api/avisar-apuntados, email+push — en ese rato, aquí ya no
 *     se repite el push a los apuntados; la bandeja sí se rellena).
 *  d) Push de avisos que crea la base (ganador de sorteo, lista de espera).
 *
 * Idempotente: cada aviso lleva una clave única por persona (`1h:<tardeo>:<versión
 * de horario>`, `fin:…`, `cambio:…`, `cancel:…`) y solo se manda push de los
 * recién creados. Ejecutarlo dos veces no duplica nada.
 */
export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Falta CRON_SECRET en el servidor." }, { status: 500 });
  if (!secretoCronValido(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_SB || !SERVICE) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  const db = createClient(URL_SB, SERVICE);

  // Pruebas con fecha simulada: ?ahora=2026-10-24T14:10:00Z (sigue exigiendo el secreto).
  const ahoraQ = new URL(req.url).searchParams.get("ahora");
  const ahora = ahoraQ && !Number.isNaN(Date.parse(ahoraQ)) ? new Date(ahoraQ) : new Date();
  const resumen: Record<string, number> = { unaHora: 0, fin: 0, cambio: 0, cancelacion: 0, push: 0, pushPendientes: 0 };

  const pref = await preferencias(db);
  const conGuardados = await ajusteGuardados(db);

  // ---- a) y b): tardeos de ayer a mañana (el fin puede caer de madrugada) ----
  const dia = (d: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(ahora.getTime() + d * 86400000));
  // «Visible» = publicado, o programado cuya hora de salida ya llegó: la web
  // lo enseña y deja apuntarse, pero su estado no cambia nunca a 'publicado'.
  // Filtrando solo 'publicado', sus apuntados se quedaban sin ningún aviso.
  const visible = `estado.eq.publicado,and(estado.eq.programado,publicar_en.lte.${ahora.toISOString()})`;
  const { data: tardeos, error: eT } = await db.from("tardeos")
    .select("id,titulo,fecha,hora_inicio,hora_fin,horario_version")
    .or(visible).gte("fecha", dia(-1)).lte("fecha", dia(1));
  if (eT) {
    registrar("avisos", "no se pudieron leer los tardeos (¿falta el lote 67?)", eT);
    return NextResponse.json({ error: "No se pudieron leer los tardeos. ¿Falta el lote 67?" }, { status: 500 });
  }

  const nuevos: { profile_id: string; aviso: TextoAviso }[] = [];
  for (const t of tardeos ?? []) {
    const fase = faseDebida(t, ahora);
    if (!fase) continue;
    const apuntados = await inscritos(db, t.id);
    if (fase === "1h") {
      const guardados = conGuardados ? await guardadosDe(db, t.id) : [];
      const dest = [...new Set([...apuntados, ...guardados])].filter((p) => pref.get(p)?.recordatorios !== false);
      if (!dest.length) continue;
      const { cartel, delCartel } = await setsDelCartel(db, t.id);
      const favs = await setsFavoritos(db, dest);
      const min = minutosHastaInicio(t, ahora);
      for (const p of dest) {
        nuevos.push({ profile_id: p, aviso: textoUnaHora(t, min, elegirPropuesta(favs.get(p) ?? [], delCartel, cartel)) });
      }
      resumen.unaHora += dest.length;
    } else {
      // La encuesta es solo para quien tenía plaza: a los guardados no. Ni a
      // quien el local marcó «no vino»: la encuesta le diría «no estuviste».
      const noVinieron = await noAsistieron(db, t.id);
      const dest = apuntados.filter((p) => pref.get(p)?.fin_evento !== false && !noVinieron.has(p));
      for (const p of dest) nuevos.push({ profile_id: p, aviso: textoFin(t) });
      resumen.fin += dest.length;
    }
  }

  // ---- c) cambios de horario y cancelaciones ----
  const hace48 = new Date(ahora.getTime() - 48 * 3600000).toISOString();
  const { data: cambiados, error: eC } = await db.from("tardeos")
    .select("id,titulo,fecha,hora_inicio,hora_fin,horario_version")
    .or(visible).gte("horario_cambiado_en", hace48)
    .lte("horario_cambiado_en", new Date(ahora.getTime() - ESPERA_CAMBIO_MS).toISOString());
  if (eC) registrar("avisos", "no se pudieron leer los cambios de horario", eC);
  for (const t of cambiados ?? []) {
    if (instantesTardeo(t).inicio <= ahora) continue; // ya empezó: no tiene sentido
    const dest = [...new Set([...(await inscritos(db, t.id)), ...(await guardadosDe(db, t.id))])];
    for (const p of dest) nuevos.push({ profile_id: p, aviso: textoCambio(t) });
    resumen.cambio += dest.length;
  }

  const sinPushA = new Set<string>(); // "<perfil>|<clave>": ya avisados por /api/avisar-apuntados
  const { data: cancelados, error: eX } = await db.from("tardeos")
    .select("id,titulo,fecha,avisado_cancelacion_en,cancelado_en")
    .eq("estado", "cancelado").gte("cancelado_en", hace48)
    .lte("cancelado_en", new Date(ahora.getTime() - ESPERA_CANCELACION_MS).toISOString())
    .gte("fecha", dia(0));
  if (eX) registrar("avisos", "no se pudieron leer las cancelaciones", eX);
  for (const t of cancelados ?? []) {
    // También a quien estaba en lista de espera: también contaba con ir.
    const ap = await inscritos(db, t.id, ["apuntado", "espera"]);
    const dest = [...new Set([...ap, ...(await guardadosDe(db, t.id))])];
    const av = textoCancelacion(t);
    if (t.avisado_cancelacion_en) ap.forEach((p) => sinPushA.add(`${p}|${av.clave}`));
    for (const p of dest) nuevos.push({ profile_id: p, aviso: av });
    resumen.cancelacion += dest.length;
  }

  // ---- Bandeja: crea los avisos (los repetidos no se crean) ----
  const creados: { id: string; profile_id: string; clave: string }[] = [];
  for (let i = 0; i < nuevos.length; i += 500) {
    const lote = nuevos.slice(i, i + 500).map((n) => ({ profile_id: n.profile_id, ...n.aviso }));
    const { data, error } = await db.rpc("crear_avisos_lote", { p_avisos: lote });
    if (error) { registrar("avisos", "no se pudieron crear los avisos (¿falta el lote 67?)", error); break; }
    creados.push(...((data ?? []) as typeof creados));
  }
  const porClave = new Map(nuevos.map((n) => [`${n.profile_id}|${n.aviso.clave}`, n.aviso]));
  const aPush = creados.filter((c) => !sinPushA.has(`${c.profile_id}|${c.clave}`))
    .map((c) => ({ id: c.id, profile_id: c.profile_id, aviso: porClave.get(`${c.profile_id}|${c.clave}`)! }))
    .filter((c) => c.aviso);

  // ---- d) avisos creados por la base sin push todavía ----
  const { data: pendientes } = await db.from("avisos").select("id,profile_id,tipo,titulo,cuerpo,url,clave")
    .is("push_en", null).in("tipo", ["sorteo", "espera"])
    .gte("created_at", new Date(ahora.getTime() - 2 * 3600000).toISOString()).limit(500);
  for (const a of pendientes ?? []) {
    aPush.push({ id: a.id, profile_id: a.profile_id, aviso: { tipo: a.tipo, titulo: a.titulo, cuerpo: a.cuerpo ?? "", url: a.url ?? "/avisos", clave: a.clave ?? "" } });
    resumen.pushPendientes++;
  }

  resumen.push = await enviarPush(db, aPush);
  return NextResponse.json({ ahora: ahora.toISOString(), creados: creados.length, ...resumen });
}

export async function GET() {
  return NextResponse.json({ error: "Método no permitido. Usa POST." }, { status: 405, headers: { Allow: "POST" } });
}

// ------------------------------------------------------------------------------

async function inscritos(db: SupabaseClient, tardeo: string, estados = ["apuntado"]): Promise<string[]> {
  // "Asistiré" = inscripción 'apuntado'. Al cancelar el tardeo no se tocan,
  // así que sirven también para avisar de la cancelación.
  const { data, error } = await db.from("inscripciones").select("profile_id").eq("tardeo_id", tardeo).in("estado", estados);
  // Un fallo aquí NO es «nadie apuntado»: se para la pasada (el cron vuelve a
  // los 10 min y, como es idempotente, no duplica nada).
  if (error) throw new Error(`No se pudieron leer los inscritos de ${tardeo}: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.profile_id as string))];
}

/** Quien el local marcó «no vino» (lote 48). Si no se puede leer, nadie: mejor avisar de más. */
async function noAsistieron(db: SupabaseClient, tardeo: string): Promise<Set<string>> {
  const { data, error } = await db.from("inscripciones").select("profile_id")
    .eq("tardeo_id", tardeo).eq("asistencia", "no_asistio");
  return new Set(error ? [] : (data ?? []).map((r) => r.profile_id as string));
}

async function guardadosDe(db: SupabaseClient, tardeo: string): Promise<string[]> {
  // `favoritos` existe en producción sin lote: si falta, simplemente no hay guardados.
  const { data, error } = await db.from("favoritos").select("profile_id").eq("tardeo_id", tardeo);
  if (error) return [];
  return [...new Set((data ?? []).map((r) => r.profile_id as string))];
}

async function preferencias(db: SupabaseClient) {
  const m = new Map<string, { recordatorios: boolean; fin_evento: boolean }>();
  const { data, error } = await db.from("preferencias_avisos").select("profile_id,recordatorios,fin_evento")
    .or("recordatorios.eq.false,fin_evento.eq.false");
  if (!error) for (const r of data ?? []) m.set(r.profile_id, r);
  return m;
}

async function ajusteGuardados(db: SupabaseClient) {
  const { data } = await db.from("ajustes").select("valor").eq("clave", "avisos_1h_guardados").maybeSingle();
  return data?.valor === "true";
}

/**
 * Sets de los DJs del cartel. Primero la tabla `sets` (lote 65, equipo de
 * Música); si aún no existe, las sesiones de `dj_contenidos` (lote 27).
 */
async function setsDelCartel(db: SupabaseClient, tardeo: string): Promise<{ cartel: string[]; delCartel: SetPropuesta[] }> {
  const { data: td } = await db.from("tardeo_djs").select("dj_id,djs(nombre_artistico)").eq("tardeo_id", tardeo);
  const cartel = (td ?? []).map((r) => r.dj_id as string);
  if (!cartel.length) return { cartel, delCartel: [] };
  const nombre = new Map((td ?? []).map((r) => {
    const d = r.djs as unknown as { nombre_artistico?: string } | { nombre_artistico?: string }[] | null;
    return [r.dj_id as string, (Array.isArray(d) ? d[0] : d)?.nombre_artistico ?? null] as const;
  }));
  const s = await db.from("sets").select("id,titulo,dj_id").in("dj_id", cartel).order("created_at", { ascending: false }).limit(5);
  if (!s.error && s.data?.length) return { cartel, delCartel: s.data.map((x) => ({ ...x, dj_nombre: nombre.get(x.dj_id) })) };
  const c = await db.from("dj_contenidos").select("id,titulo,dj_id,url").in("dj_id", cartel).eq("tipo", "sesion")
    .order("created_at", { ascending: false }).limit(5);
  return { cartel, delCartel: (c.data ?? []).map((x) => ({ ...x, titulo: x.titulo || "Una sesión", dj_nombre: nombre.get(x.dj_id) })) };
}

/** Sets guardados por cada persona (lote 65). Si la tabla no existe, ninguno. */
async function setsFavoritos(db: SupabaseClient, perfiles: string[]): Promise<Map<string, SetPropuesta[]>> {
  const m = new Map<string, SetPropuesta[]>();
  const { data, error } = await db.from("sets_guardados").select("profile_id,sets(id,titulo,dj_id)").in("profile_id", perfiles);
  if (error) return m;
  for (const r of data ?? []) {
    const s = (Array.isArray(r.sets) ? r.sets[0] : r.sets) as SetPropuesta | null;
    if (!s) continue;
    m.set(r.profile_id, [...(m.get(r.profile_id) ?? []), s]);
  }
  return m;
}

async function enviarPush(db: SupabaseClient, lista: { id: string; profile_id: string; aviso: TextoAviso }[]): Promise<number> {
  const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const PRIV = process.env.VAPID_PRIVATE_KEY;
  if (!lista.length) return 0;
  const ahoraIso = new Date().toISOString();
  // Sin VAPID no hay push, pero se marca igual: la bandeja ya lo tiene y no
  // queremos reintentar eternamente.
  if (!PUB || !PRIV) {
    await marcar(db, lista.map((l) => l.id), ahoraIso);
    return 0;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hola@tardeosclub.app", PUB, PRIV);
  const ids = [...new Set(lista.map((l) => l.profile_id))];
  const subs: { id: string; endpoint: string; p256dh: string; auth: string; profile_id: string }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("push_suscripciones").select("id,endpoint,p256dh,auth,profile_id").in("profile_id", ids.slice(i, i + 200));
    subs.push(...((data ?? []) as typeof subs).filter((s) => endpointPushPermitido(s.endpoint)));
  }
  const porPerfil = new Map<string, typeof subs>();
  subs.forEach((s) => porPerfil.set(s.profile_id, [...(porPerfil.get(s.profile_id) ?? []), s]));

  let enviados = 0;
  const muertas: string[] = [];
  const trabajos = lista.flatMap((l) => (porPerfil.get(l.profile_id) ?? []).map((s) => ({ s, l })));
  for (let i = 0; i < trabajos.length; i += 10) {
    await Promise.all(trabajos.slice(i, i + 10).map(async ({ s, l }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ titulo: l.aviso.titulo, mensaje: l.aviso.cuerpo, url: l.aviso.url, aviso: l.id, tag: l.aviso.clave }));
        enviados++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) muertas.push(s.id);
      }
    }));
  }
  if (muertas.length) await db.from("push_suscripciones").delete().in("id", muertas);
  await marcar(db, lista.map((l) => l.id), ahoraIso);
  return enviados;
}

async function marcar(db: SupabaseClient, ids: string[], cuando: string) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from("avisos").update({ push_en: cuando }).in("id", ids.slice(i, i + 200));
    if (error) { registrar("avisos", "no se pudo marcar push_en", error); return; }
  }
}
