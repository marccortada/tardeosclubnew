import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { autorizarAdminGlobal, endpointPushPermitido, urlInternaSegura } from "@/lib/apiAuth";
import { encajaSegmento } from "@/lib/segmentacion";

export const runtime = "nodejs";

/**
 * Manda una notificación push a los dispositivos suscritos, a todos o solo a
 * los que encajan con un segmento de gustos.
 *
 * Solo admin: esto le suena el móvil a toda la base de usuarios, así que es
 * el equivalente a un megáfono.
 */
export async function POST(req: Request) {
  let body: {
    segmento?: { musica?: string[]; tiposEvento?: string[]; edades?: string[]; zonas?: string[] };
    soloContar?: boolean; titulo?: string; mensaje?: string; url?: string; accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  // La sesión ANTES que la configuración: qué falta en el servidor no es
  // asunto de un visitante anónimo.
  // Un push le suena a TODA la base: solo admin general, no de zona ni de tarea.
  const auth = await autorizarAdminGlobal(body.accessToken, req);
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
  const url = urlInternaSegura(body.url);

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hola@tardeosclub.app", VAPID_PUB, VAPID_PRIV);

  const admin = createClient(URL_SB, SERVICE_ROLE);
  // Por lotes de 1000: PostgREST corta cada respuesta a 1000 filas y, de una
  // vez, a partir de la suscripción 1001 nadie recibía el aviso.
  type Sub = { id: string; endpoint: string; p256dh: string; auth: string; profile_id: string | null };
  const subs: Sub[] = [];
  const LOTE = 1000;
  for (let desde = 0; ; desde += LOTE) {
    const { data, error } = await admin
      .from("push_suscripciones")
      .select("id,endpoint,p256dh,auth,profile_id")
      .order("id")
      .range(desde, desde + LOTE - 1);
    if (error) return NextResponse.json({ error: "No se pudieron leer las suscripciones. Inténtalo otra vez." }, { status: 500 });
    subs.push(...((data ?? []) as Sub[]));
    if (!data || data.length < LOTE) break;
  }

  /**
   * A quién le toca, según su ADN.
   *
   * Un tardeo de Mataró no le interesa a alguien de Girona, y el que recibe
   * tres avisos que no van con él desactiva el cuarto. El aviso sin segmentar
   * no es "más alcance": es gastarse la lista.
   *
   * Se decide AQUÍ y no en el navegador, al revés que los pop-ups: la
   * notificación se manda desde el servidor, así que es el servidor quien tiene
   * que saber a qué endpoints. Los gustos no salen de aquí: se leen, se filtra
   * y no se devuelven.
   *
   * Un criterio vacío no restringe, y los puestos se exigen TODOS. Y sin gustos
   * rellenados NO se recibe un aviso segmentado, igual que con los pop-ups:
   * mandárselo "por si acaso" es exactamente lo que hace que la gente desactive.
   */
  const seg = body.segmento ?? {};
  const hayCriterios = Object.values(seg).some((v) => Array.isArray(v) && v.length > 0);

  // Defensa en profundidad: aunque la tabla tuviera un endpoint raro, nunca se
  // hace una petición a un host que no sea un servicio de push conocido.
  const subsValidas = subs.filter((s) => endpointPushPermitido(s.endpoint));

  let destinatarias = subsValidas;
  if (hayCriterios) {
    const ids = [...new Set(destinatarias.map((s) => s.profile_id).filter(Boolean))] as string[];
    const { data: perfiles } = ids.length
      ? await admin.from("profiles").select("id,musica,tipos_evento,publico,zonas").in("id", ids)
      : { data: [] as { id: string; musica: string[] | null; tipos_evento: string[] | null; publico: string | null; zonas: string[] | null }[] };
    const porId = new Map((perfiles ?? []).map((p) => [p.id, p]));

    // La MISMA regla que los pop-ups (lib/segmentacion): pedir una familia
    // ("Electrónica") alcanza a quien marcó solo un estilo de ella ("Afro
    // House"). Antes aquí se exigía coincidencia exacta y la familia entera se
    // quedaba sin su público más interesado.
    const segmento = {
      seg_musica: seg.musica, seg_tipos_evento: seg.tiposEvento, seg_edades: seg.edades, seg_zonas: seg.zonas,
    };

    destinatarias = destinatarias.filter((s) => {
      if (!s.profile_id) return false;            // sin cuenta no hay gustos que mirar
      const p = porId.get(s.profile_id);
      if (!p) return false;
      return encajaSegmento(segmento, {
        musica: p.musica ?? [], tiposEvento: p.tipos_evento ?? [], publico: p.publico ?? null, zonas: p.zonas ?? [],
      } as Parameters<typeof encajaSegmento>[1]);
    });
  }

  // Contar antes de enviar: quien manda un aviso a miles de móviles tiene
  // derecho a saber a cuántos va ANTES de darle al botón.
  if (body.soloContar) {
    return NextResponse.json({ destinatarias: destinatarias.length, total: subsValidas.length });
  }

  if (!destinatarias.length) return NextResponse.json({ enviadas: 0, caducadas: 0, destinatarias: 0 });
  const listaEnvio = destinatarias;

  const payload = JSON.stringify({ titulo, mensaje, url });

  // De 10 en 10: con miles de suscriptores, dispararlas todas a la vez tumba
  // la función. Las que devuelven 404/410 son navegadores que revocaron la
  // suscripción: se borran y la tabla se poda sola.
  let enviadas = 0;
  const muertas: string[] = [];
  for (let i = 0; i < listaEnvio.length; i += 10) {
    await Promise.all(
      listaEnvio.slice(i, i + 10).map(async (s) => {
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

  return NextResponse.json({ enviadas, caducadas: muertas.length, destinatarias: listaEnvio.length });
}
