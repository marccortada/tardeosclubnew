import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { autorizarAdmin } from "@/lib/apiAuth";

export const runtime = "nodejs";

/**
 * Manda una notificación push a todos los dispositivos suscritos.
 *
 * Solo admin: esto le suena el móvil a toda la base de usuarios, así que es
 * el equivalente a un megáfono. El envío por segmentos (solo locales, solo
 * DJs...) puede venir después: la tabla ya guarda profile_id para eso.
 */
export async function POST(req: Request) {
  let body: { titulo?: string; mensaje?: string; url?: string; accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  // La sesión ANTES que la configuración: qué falta en el servidor no es
  // asunto de un visitante anónimo.
  const auth = await autorizarAdmin(body.accessToken);
  if (auth instanceof NextResponse) return auth;

  const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VAPID_PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY;
  if (!URL_SB || !SERVICE_ROLE) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }
  if (!VAPID_PUB || !VAPID_PRIV) {
    return NextResponse.json({ error: "Faltan las claves VAPID en el servidor." }, { status: 500 });
  }

  const titulo = (body.titulo ?? "").trim();
  if (!titulo) return NextResponse.json({ error: "La notificación necesita un título." }, { status: 400 });
  const mensaje = (body.mensaje ?? "").trim();
  // Solo rutas internas: una notificación nuestra jamás debe abrir una web ajena.
  const url = body.url?.startsWith("/") ? body.url : "/tardeos";

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hola@tardeosclub.app", VAPID_PUB, VAPID_PRIV);

  const admin = createClient(URL_SB, SERVICE_ROLE);
  const { data: subs, error } = await admin
    .from("push_suscripciones")
    .select("id,endpoint,p256dh,auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ enviadas: 0, caducadas: 0 });

  const payload = JSON.stringify({ titulo, mensaje, url });

  // De 10 en 10: con miles de suscriptores, dispararlas todas a la vez tumba
  // la función. Las que devuelven 404/410 son navegadores que revocaron la
  // suscripción: se borran y la tabla se poda sola.
  let enviadas = 0;
  const muertas: string[] = [];
  for (let i = 0; i < subs.length; i += 10) {
    await Promise.all(
      subs.slice(i, i + 10).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          enviadas++;
        } catch (e: unknown) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) muertas.push(s.id);
        }
      })
    );
  }
  if (muertas.length) await admin.from("push_suscripciones").delete().in("id", muertas);

  return NextResponse.json({ enviadas, caducadas: muertas.length });
}
