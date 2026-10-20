import { Resend } from "resend";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { autorizarUsuario, endpointPushPermitido, pasaLimite, respuestaLimite } from "@/lib/apiAuth";
import { registrar } from "@/lib/registro";
import { MARCA } from "@/lib/marca";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Avisar a los apuntados de un tardeo CANCELADO (email y/o push).
 *
 * Lo puede usar el dueño del local del tardeo o un admin, y solo con el
 * tardeo ya en estado «cancelado»: así esta ruta no sirve de megáfono para
 * mandar lo que sea a quien se apuntó. El texto lo fija el servidor; el local
 * solo puede añadir una nota corta.
 *
 * `soloContar: true` no envía nada: dice a cuántos llegaría y por qué vías, y
 * la pantalla lo enseña ANTES de pulsar (si no hay email ni push configurados,
 * lo dice claro en vez de fingir que avisa).
 */
export async function POST(req: Request) {
  let body: { tardeoId?: string; nota?: string; soloContar?: boolean; accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const auth = await autorizarUsuario(body.accessToken, req);
  if (auth instanceof NextResponse) return auth;

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.RESEND_FROM || `${MARCA.nombre} <onboarding@resend.dev>`;
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || `https://${MARCA.dominio}`;
  const VAPID_PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY;

  const tardeoId = String(body.tardeoId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(tardeoId)) return NextResponse.json({ error: "Tardeo no válido." }, { status: 400 });

  const admin = createClient(SUPA_URL, SERVICE_ROLE);
  const { data: t, error: eT } = await admin
    .from("tardeos")
    .select("id,titulo,fecha,hora_inicio,estado,locales(nombre,owner_id)")
    .eq("id", tardeoId)
    .maybeSingle();
  if (eT) { registrar("avisar-apuntados", "no se pudo leer el tardeo", eT); return NextResponse.json({ error: "No se pudo leer el tardeo. Inténtalo otra vez." }, { status: 500 }); }
  if (!t) return NextResponse.json({ error: "No existe ese tardeo." }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const local = (Array.isArray((t as any).locales) ? (t as any).locales[0] : (t as any).locales) as { nombre: string; owner_id: string | null } | null;

  // Dueño del local del tardeo, o admin. La misma regla que owns_tardeo().
  if (!auth.esAdmin && local?.owner_id !== auth.uid) {
    return NextResponse.json({ error: "Este tardeo no es de tu local." }, { status: 403 });
  }
  const { data: ins, error: eI } = await admin
    .from("inscripciones")
    .select("profile_id,profiles(email)")
    .eq("tardeo_id", tardeoId)
    .eq("estado", "apuntado");
  if (eI) { registrar("avisar-apuntados", "no se pudieron leer los apuntados", eI); return NextResponse.json({ error: "No se pudo leer la lista de confirmados. Inténtalo otra vez." }, { status: 500 }); }

  const emails = new Map<string, string>();
  const perfiles = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (ins ?? []) as any[]) {
    if (!r.profile_id) continue;
    perfiles.add(r.profile_id);
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    if (p?.email && !emails.has(r.profile_id)) emails.set(r.profile_id, p.email);
  }

  const hayEmail = !!RESEND_API_KEY;
  const hayPush = !!(VAPID_PUB && VAPID_PRIV);
  const ids = [...perfiles];
  const { data: subsCrudas } = hayPush && ids.length
    ? await admin.from("push_suscripciones").select("id,endpoint,p256dh,auth,profile_id").in("profile_id", ids)
    : { data: [] as { id: string; endpoint: string; p256dh: string; auth: string; profile_id: string }[] };
  const subs = (subsCrudas ?? []).filter((s) => endpointPushPermitido(s.endpoint));

  if (body.soloContar) {
    return NextResponse.json({
      apuntados: perfiles.size,
      conEmail: hayEmail ? emails.size : 0,
      conPush: hayPush ? new Set(subs.map((s) => s.profile_id)).size : 0,
      email: hayEmail,
      push: hayPush,
    });
  }

  // Contar se puede antes de cancelar (la pantalla lo enseña en la
  // confirmación); ENVIAR, solo con el tardeo ya cancelado.
  if (t.estado !== "cancelado") {
    return NextResponse.json({ error: "Solo se avisa de tardeos cancelados." }, { status: 400 });
  }
  if (!hayEmail && !hayPush) {
    return NextResponse.json({ error: "El envío de avisos no está configurado en el servidor (faltan RESEND_API_KEY y las claves VAPID)." }, { status: 503 });
  }
  if (perfiles.size === 0) return NextResponse.json({ emails: 0, push: 0, apuntados: 0 });

  // Una cancelación no se avisa veinte veces: tope por usuario y hora…
  if (!(await pasaLimite(`avisar:${auth.uid}`, 10))) return respuestaLimite("avisos a confirmados");

  // …y, sobre todo, UNA sola vez por tardeo. Se "reserva" el envío de forma
  // atómica: solo pasa quien consigue poner la marca estando vacía. Si la
  // columna aún no existe (falta el lote 57), queda solo el tope de arriba.
  const { data: marcado, error: eM } = await admin
    .from("tardeos")
    .update({ avisado_cancelacion_en: new Date().toISOString() })
    .eq("id", tardeoId)
    .is("avisado_cancelacion_en", null)
    .select("id");
  const faltaColumna = !!eM && /avisado_cancelacion_en|PGRST204|42703/.test(`${eM.code} ${eM.message}`);
  if (eM && !faltaColumna) {
    registrar("avisar-apuntados", "no se pudo marcar el aviso", eM);
    return NextResponse.json({ error: "No se pudo enviar el aviso. Inténtalo otra vez." }, { status: 500 });
  }
  if (!eM && !marcado?.length) {
    return NextResponse.json({ error: "Ya se avisó a los confirmados de esta cancelación." }, { status: 409 });
  }

  const nota = String(body.nota ?? "").trim().slice(0, 300);
  const hora = String(t.hora_inicio ?? "").slice(0, 5);
  const fecha = new Date(`${t.fecha}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const nombreLocal = local?.nombre ?? "";

  let enviadosEmail = 0;
  if (hayEmail && emails.size) {
    const resend = new Resend(RESEND_API_KEY);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#D61AA8;padding:24px;border-radius:20px 20px 0 0;color:#fff">
          <p style="margin:0;font-weight:800;letter-spacing:.5px">${MARCA.nombre.toUpperCase()} · AVISO</p>
          <h1 style="margin:6px 0 0;font-size:24px">Tardeo cancelado</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 20px 20px">
          <h2 style="margin:0 0 4px;color:#2A1721;font-size:21px">${esc(t.titulo)}</h2>
          <p style="font-size:16px;color:#555;margin:0">${esc(nombreLocal)} · ${esc(fecha)}${hora ? ` · ${hora}h` : ""}</p>
          <p style="font-size:16px;color:#2A1721;margin:16px 0 0">El organizador ha cancelado este tardeo. Tu plaza queda anulada; no tienes que hacer nada.</p>
          ${nota ? `<p style="font-size:16px;color:#2A1721;margin:12px 0 0;padding:12px;background:#f7f3f5;border-radius:12px">${esc(nota)}</p>` : ""}
          <a href="${SITE}/tardeos" style="display:inline-block;margin-top:18px;background:#D61AA8;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:14px">Ver otros tardeos</a>
          <p style="margin-top:20px;font-size:12px;color:#999">Te llega porque te apuntaste a este tardeo en ${MARCA.nombre}.</p>
        </div>
      </div>`;
    const lista = [...emails.values()];
    for (let i = 0; i < lista.length; i += 100) {
      const lote = lista.slice(i, i + 100).map((to) => ({ from: FROM, to: [to], subject: `Cancelado: ${t.titulo}`, html }));
      try {
        const { error } = await resend.batch.send(lote);
        if (error) registrar("avisar-apuntados", `fallo de Resend en "${t.titulo}"`, error);
        else enviadosEmail += lote.length;
      } catch (e) {
        registrar("avisar-apuntados", `excepción al enviar "${t.titulo}"`, e);
      }
    }
  }

  let enviadosPush = 0;
  if (hayPush && subs.length) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hola@tardeosclub.app", VAPID_PUB!, VAPID_PRIV!);
    const payload = JSON.stringify({
      titulo: `Cancelado: ${t.titulo}`,
      mensaje: nota || `${nombreLocal ? nombreLocal + " · " : ""}${fecha}. Tu plaza queda anulada.`,
      url: "/tardeos",
    });
    const muertas: string[] = [];
    for (let i = 0; i < subs.length; i += 10) {
      await Promise.all(subs.slice(i, i + 10).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          enviadosPush++;
        } catch (e: unknown) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) muertas.push(s.id);
        }
      }));
    }
    if (muertas.length) await admin.from("push_suscripciones").delete().in("id", muertas);
  }

  // Si no ha salido NADA (Resend caído, todas las suscripciones muertas…), la
  // marca de arriba impediría reintentar para siempre: se quita y se dice.
  if (enviadosEmail === 0 && enviadosPush === 0) {
    if (!faltaColumna) {
      const { error: eD } = await admin.from("tardeos").update({ avisado_cancelacion_en: null }).eq("id", tardeoId);
      if (eD) registrar("avisar-apuntados", "no se pudo quitar la marca tras un envío fallido", eD);
    }
    const habiaA = (hayEmail ? emails.size : 0) + (hayPush ? subs.length : 0);
    if (habiaA > 0) {
      return NextResponse.json({ error: "No se pudo enviar ningún aviso. Inténtalo otra vez en un rato." }, { status: 502 });
    }
  }

  return NextResponse.json({ apuntados: perfiles.size, emails: enviadosEmail, push: enviadosPush });
}

export async function GET() {
  return NextResponse.json({ error: "Método no permitido. Usa POST." }, { status: 405, headers: { Allow: "POST" } });
}

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
