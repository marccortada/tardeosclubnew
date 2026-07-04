import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const FROM = process.env.RESEND_FROM || "TardeosClub <onboarding@resend.dev>";

  if (!RESEND_API_KEY) return NextResponse.json({ error: "Falta RESEND_API_KEY en el servidor." }, { status: 500 });
  if (!SERVICE_ROLE || !URL) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });

  let body: { titulo?: string; mensaje?: string; accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const { titulo = "", mensaje = "", accessToken } = body;
  if (!titulo.trim()) return NextResponse.json({ error: "Falta el título de la oferta." }, { status: 400 });
  if (!accessToken) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  // Cliente con service role (bypassa RLS) — solo en el servidor
  const admin = createClient(URL, SERVICE_ROLE);

  // 1) Verificar que quien lo pide es ADMIN
  const { data: userData } = await admin.auth.getUser(accessToken);
  const uid = userData?.user?.id;
  if (!uid) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Solo administradores." }, { status: 403 });

  // 2) Emails de los dueños de locales
  const { data: locs } = await admin.from("locales").select("owner_id");
  const ownerIds = Array.from(new Set((locs ?? []).map((l: any) => l.owner_id).filter(Boolean)));
  if (ownerIds.length === 0) return NextResponse.json({ enviados: 0, total: 0, aviso: "No hay locales registrados." });

  const { data: profs } = await admin.from("profiles").select("email").in("id", ownerIds);
  const emails = Array.from(new Set((profs ?? []).map((p: any) => p.email).filter(Boolean)));
  if (emails.length === 0) return NextResponse.json({ enviados: 0, total: 0, aviso: "Los locales no tienen email." });

  // 3) Enviar con Resend (en lotes de 100)
  const resend = new Resend(RESEND_API_KEY);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#E10A5A,#F5B301);padding:28px;border-radius:20px 20px 0 0;color:#fff">
        <p style="margin:0;font-weight:800;letter-spacing:.5px">TARDEOSCLUB · OFERTA</p>
        <h1 style="margin:6px 0 0;font-size:26px">${escapeHtml(titulo)}</h1>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 20px 20px">
        <p style="font-size:16px;color:#2A1721;white-space:pre-line">${escapeHtml(mensaje)}</p>
        <a href="https://tardeosclub.com" style="display:inline-block;margin-top:16px;background:#E10A5A;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:14px">Ir a TardeosClub</a>
        <p style="margin-top:20px;font-size:12px;color:#999">Recibes este email por ser local de TardeosClub. Sal, conecta y vive el tardeo.</p>
      </div>
    </div>`;

  let enviados = 0;
  try {
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100).map((to) => ({
        from: FROM,
        to: [to],
        subject: `TardeosClub · ${titulo}`,
        html,
      }));
      const { error } = await resend.batch.send(chunk);
      if (!error) enviados += chunk.length;
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error enviando emails.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ enviados, total: emails.length });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
