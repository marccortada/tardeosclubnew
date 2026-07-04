import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Recordatorio a los apuntados de los tardeos de MAÑANA.
// Pensado para ejecutarse 1 vez al día desde un cron.
// Protégelo con la cabecera:  x-cron-secret: <CRON_SECRET>
// (o ?secret=<CRON_SECRET> en la URL).

async function handler(req: Request) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const FROM = process.env.RESEND_FROM || "TardeosClub <onboarding@resend.dev>";
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tardeosclub.com";
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) return NextResponse.json({ error: "Falta CRON_SECRET en el servidor." }, { status: 500 });

  // Autorización por secreto (cabecera o query)
  const reqUrl = new URL(req.url);
  const secret = req.headers.get("x-cron-secret") || reqUrl.searchParams.get("secret");
  if (secret !== CRON_SECRET) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (!RESEND_API_KEY) return NextResponse.json({ error: "Falta RESEND_API_KEY." }, { status: 500 });
  if (!SERVICE_ROLE || !SUPA_URL) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

  const admin = createClient(SUPA_URL, SERVICE_ROLE);
  const resend = new Resend(RESEND_API_KEY);

  // Fecha de mañana en zona horaria de España
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });
  const manana = fmt.format(new Date(Date.now() + 24 * 3600 * 1000));

  // Tardeos publicados de mañana
  const { data: tardeos } = await admin
    .from("tardeos")
    .select("id,titulo,fecha,hora_inicio,locales(nombre)")
    .eq("estado", "publicado")
    .eq("fecha", manana);

  if (!tardeos || tardeos.length === 0) {
    return NextResponse.json({ fecha: manana, tardeos: 0, enviados: 0, aviso: "No hay tardeos mañana." });
  }

  let enviados = 0;
  const detalle: { tardeo: string; apuntados: number }[] = [];

  for (const t of tardeos as any[]) {
    const { data: ins } = await admin
      .from("inscripciones")
      .select("profiles(email,display_name)")
      .eq("tardeo_id", t.id)
      .eq("estado", "apuntado");

    const emails = Array.from(
      new Set((ins ?? []).map((r: any) => r.profiles?.email).filter(Boolean))
    );
    detalle.push({ tardeo: t.titulo, apuntados: emails.length });
    if (emails.length === 0) continue;

    const localNombre = t.locales?.nombre || "";
    const hora = (t.hora_inicio ?? "").slice(0, 5);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#E10A5A,#F5B301);padding:28px;border-radius:20px 20px 0 0;color:#fff">
          <p style="margin:0;font-weight:800;letter-spacing:.5px">TARDEOSCLUB · RECORDATORIO</p>
          <h1 style="margin:6px 0 0;font-size:26px">¡Mañana es tu tardeo!</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 20px 20px">
          <h2 style="margin:0 0 4px;color:#2A1721;font-size:22px">${escapeHtml(t.titulo)}</h2>
          <p style="font-size:16px;color:#555;margin:0">${escapeHtml(localNombre)}${hora ? ` · ${hora}h` : ""}</p>
          <a href="${SITE}/tardeos/${t.id}" style="display:inline-block;margin-top:16px;background:#E10A5A;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:14px">Ver el tardeo</a>
          <p style="margin-top:20px;font-size:12px;color:#999">Te apuntaste en TardeosClub. Sal, conecta y vive el tardeo.</p>
        </div>
      </div>`;

    try {
      for (let i = 0; i < emails.length; i += 100) {
        const chunk = emails.slice(i, i + 100).map((to) => ({
          from: FROM,
          to: [to],
          subject: `Mañana: ${t.titulo} 🎉`,
          html,
        }));
        const { error } = await resend.batch.send(chunk);
        if (!error) enviados += chunk.length;
      }
    } catch {
      // seguimos con el siguiente tardeo
    }
  }

  return NextResponse.json({ fecha: manana, tardeos: tardeos.length, enviados, detalle });
}

export const GET = handler;
export const POST = handler;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
