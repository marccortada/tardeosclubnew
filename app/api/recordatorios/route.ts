import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { secretoCronValido } from "@/lib/apiAuth";
import { registrar } from "@/lib/registro";
import { MARCA } from "@/lib/marca";

export const runtime = "nodejs";
export const maxDuration = 60;

// Recordatorio a los apuntados de los tardeos de MAÑANA.
// Pensado para ejecutarse 1 vez al día desde un cron.
// Solo POST, y el secreto SOLO por cabecera:  x-cron-secret: <CRON_SECRET>
// (nunca en la URL: acaba en logs). Es idempotente: la tabla
// `recordatorios_enviados` (supabase/46_seguridad.sql) impide avisar dos veces
// a la misma persona del mismo tardeo, aunque el cron se ejecute repetido.

async function handler(req: Request) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const FROM = process.env.RESEND_FROM || `${MARCA.nombre} <onboarding@resend.dev>`;
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || `https://${MARCA.dominio}`;
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) return NextResponse.json({ error: "Falta CRON_SECRET en el servidor." }, { status: 500 });

  // Autorización por secreto (solo cabecera, comparación en tiempo constante)
  if (!secretoCronValido(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (!RESEND_API_KEY) return NextResponse.json({ error: "Falta RESEND_API_KEY." }, { status: 500 });
  if (!SERVICE_ROLE || !SUPA_URL) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

  const admin = createClient(SUPA_URL, SERVICE_ROLE);
  const resend = new Resend(RESEND_API_KEY);

  // Fecha de mañana en zona horaria de España
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });
  const manana = fmt.format(new Date(Date.now() + 24 * 3600 * 1000));

  // Tardeos de mañana que la web enseña: publicados, o programados cuya hora
  // de salida ya llegó (su estado no cambia nunca a 'publicado').
  const { data: tardeos, error: eT } = await admin
    .from("tardeos")
    .select("id,titulo,fecha,hora_inicio,locales(nombre)")
    .or(`estado.eq.publicado,and(estado.eq.programado,publicar_en.lte.${new Date().toISOString()})`)
    .eq("fecha", manana);

  // Un fallo de lectura NO es «no hay tardeos mañana»: así el log del cron lo enseña.
  if (eT) {
    registrar("recordatorios", "no se pudieron leer los tardeos de mañana", eT);
    return NextResponse.json({ error: "No se pudieron leer los tardeos de mañana." }, { status: 500 });
  }

  if (!tardeos || tardeos.length === 0) {
    return NextResponse.json({ fecha: manana, tardeos: 0, enviados: 0, aviso: "No hay tardeos mañana." });
  }

  let enviados = 0;
  const detalle: { tardeo: string; apuntados: number }[] = [];

  for (const t of tardeos as any[]) {
    const { data: ins } = await admin
      .from("inscripciones")
      .select("profile_id,profiles(email,display_name)")
      .eq("tardeo_id", t.id)
      .eq("estado", "apuntado");

    // Una entrada por persona (por si hubiera filas repetidas) y con email.
    const porPerfil = new Map<string, string>();
    for (const r of (ins ?? []) as any[]) {
      const email = r.profiles?.email;
      if (r.profile_id && email && !porPerfil.has(r.profile_id)) porPerfil.set(r.profile_id, email);
    }

    // Quien apagó los recordatorios en /avisos (lote 67) no recibe el email.
    // Si la tabla aún no existe, se envía a todos como siempre.
    if (porPerfil.size) {
      const { data: apagados, error: eP } = await admin.from("preferencias_avisos").select("profile_id")
        .eq("recordatorios", false).in("profile_id", Array.from(porPerfil.keys()));
      if (!eP) for (const a of apagados ?? []) porPerfil.delete(a.profile_id as string);
    }

    // Idempotencia: se "reserva" cada (tardeo, persona) con on conflict do
    // nothing; solo se envía a quien se acaba de insertar. Los que ya constaban
    // se saltan. Si el envío falla se libera la reserva para poder reintentar.
    const candidatos = Array.from(porPerfil.keys());
    let pendientes: string[] = [];
    if (candidatos.length) {
      const { data: nuevos, error: errRes } = await admin
        .from("recordatorios_enviados")
        .upsert(
          candidatos.map((profile_id) => ({ tardeo_id: t.id, profile_id })),
          { onConflict: "tardeo_id,profile_id", ignoreDuplicates: true }
        )
        .select("profile_id");
      if (errRes) {
        // Sin poder registrar no enviamos: preferimos no avisar a avisar dos veces.
        registrar("recordatorios", "no se pudo reservar el envío (¿falta 46_seguridad.sql?)", errRes);
        detalle.push({ tardeo: t.titulo, apuntados: 0 });
        continue;
      }
      pendientes = (nuevos ?? []).map((n: any) => n.profile_id as string);
    }
    detalle.push({ tardeo: t.titulo, apuntados: pendientes.length });
    if (pendientes.length === 0) continue;
    const emails = pendientes.map((id) => porPerfil.get(id) as string);

    const localNombre = t.locales?.nombre || "";
    const hora = (t.hora_inicio ?? "").slice(0, 5);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#FF3DCF,#FAC72E);padding:28px;border-radius:20px 20px 0 0;color:#fff">
          <p style="margin:0;font-weight:800;letter-spacing:.5px">${MARCA.nombre.toUpperCase()} · RECORDATORIO</p>
          <h1 style="margin:6px 0 0;font-size:26px">¡Mañana es tu tardeo!</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 20px 20px">
          <h2 style="margin:0 0 4px;color:#2A1721;font-size:22px">${escapeHtml(t.titulo)}</h2>
          <p style="font-size:16px;color:#555;margin:0">${escapeHtml(localNombre)}${hora ? ` · ${hora}h` : ""}</p>
          <a href="${SITE}/tardeos/${t.id}" style="display:inline-block;margin-top:16px;background:#D61AA8;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:14px">Ver el tardeo</a>
          <p style="margin-top:20px;font-size:12px;color:#999">Te apuntaste en ${MARCA.nombre}. ${MARCA.lema}</p>
        </div>
      </div>`;

    for (let i = 0; i < emails.length; i += 100) {
      const ids = pendientes.slice(i, i + 100);
      const chunk = emails.slice(i, i + 100).map((to) => ({
        from: FROM,
        to: [to],
        subject: `Mañana: ${t.titulo} 🎉`,
        html,
      }));
      let fallo = false;
      try {
        const { error } = await resend.batch.send(chunk);
        if (error) {
          fallo = true;
          registrar("recordatorios", `fallo de Resend en "${t.titulo}"`, error);
        } else {
          enviados += chunk.length;
        }
      } catch (e) {
        fallo = true;
        registrar("recordatorios", `excepción al enviar "${t.titulo}"`, e);
      }
      if (fallo) {
        // Libera la reserva de este lote para que el próximo intento lo envíe.
        await admin.from("recordatorios_enviados").delete().eq("tardeo_id", t.id).in("profile_id", ids);
      }
    }
  }

  return NextResponse.json({ fecha: manana, tardeos: tardeos.length, enviados, detalle });
}

export const POST = handler;

// Solo POST: un GET (enlace, prefetch, rastreador) no debe disparar envíos.
export async function GET() {
  return NextResponse.json({ error: "Método no permitido. Usa POST." }, { status: 405, headers: { Allow: "POST" } });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
