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

  let body: { titulo?: string; mensaje?: string; accessToken?: string; localIds?: string[]; soloContar?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const { titulo = "", mensaje = "", accessToken, localIds, soloContar } = body;
  if (!titulo.trim() && !soloContar) return NextResponse.json({ error: "Falta el título de la oferta." }, { status: 400 });
  if (!accessToken) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  // Cliente con service role (bypassa RLS) — solo en el servidor
  const admin = createClient(URL, SERVICE_ROLE);

  // 1) Verificar que quien lo pide es ADMIN
  const { data: userData } = await admin.auth.getUser(accessToken);
  const uid = userData?.user?.id;
  if (!uid) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Solo administradores." }, { status: 403 });

  /**
   * 2) A quién se le puede escribir, que no es lo mismo que a quién se querría.
   *
   * Dos filtros, y el segundo es el importante:
   *
   *   - `localIds`: si el admin ha elegido unos cuantos, solo esos. Antes solo
   *     existía "a todos", que con una lista de verdad no se usa nunca.
   *   - `acepta_ofertas`: SOLO quien lo haya marcado. La política de privacidad
   *     dice que estos emails van "con tu consentimiento", y hasta ahora no
   *     había dónde guardarlo, así que la promesa no se podía cumplir.
   *
   * Ojo con lo que NO se hace: los 59 locales que tienen email en su ficha
   * pero no se han registrado no reciben nada. Ese email lo trajimos de la app
   * antigua y no viene con ningún permiso detrás; escribirles en masa
   * contradiría lo que dice nuestra propia política.
   */
  let q = admin.from("locales").select("id,nombre,owner_id");
  if (localIds?.length) q = q.in("id", localIds);
  const { data: locs } = await q;
  const ownerIds = Array.from(new Set((locs ?? []).map((l: any) => l.owner_id).filter(Boolean)));

  const { data: profs } = ownerIds.length
    ? await admin.from("profiles").select("email,acepta_ofertas").in("id", ownerIds)
    : { data: [] as { email: string | null; acepta_ofertas: boolean | null }[] };

  const conPermiso = (profs ?? []).filter((p: any) => p.acepta_ofertas);
  const emails = Array.from(new Set(conPermiso.map((p: any) => p.email).filter(Boolean)));

  const cuentas = {
    locales: locs?.length ?? 0,
    registrados: ownerIds.length,
    conPermiso: emails.length,
    sinPermiso: ownerIds.length - conPermiso.length,
  };

  // Contar antes de enviar: quien manda un email a terceros tiene derecho a
  // ver a cuántos va y cuántos se quedan fuera, y por qué.
  if (soloContar) return NextResponse.json(cuentas);

  if (emails.length === 0) {
    return NextResponse.json({
      enviados: 0, ...cuentas,
      aviso: ownerIds.length === 0
        ? "Ninguno de esos locales tiene cuenta registrada."
        : "Ninguno ha aceptado recibir ofertas.",
    });
  }

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

  return NextResponse.json({ enviados, total: emails.length, ...cuentas });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
