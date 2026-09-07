import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { autorizarLocalOAdmin, pasaLimite, respuestaLimite } from "@/lib/apiAuth";
import { registrar } from "@/lib/registro";

export const runtime = "nodejs";

// Leer un flyer cuesta una llamada a Claude por intento.
const LECTURAS_POR_HORA = 40;

// Esquema de salida estructurada (JSON garantizado)
const schema = {
  type: "object",
  properties: {
    titulo: { type: "string", description: "Título del tardeo, vacío si no aparece" },
    fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD, vacío si no aparece" },
    horaInicio: { type: "string", description: "Hora de inicio HH:MM (24h), vacío si no aparece" },
    horaFin: { type: "string", description: "Hora de fin HH:MM (24h), vacío si no aparece" },
    dj: { type: "string", description: "DJ(s), separados por ·, vacío si no aparece" },
    estilo: { type: "string", description: "Estilo musical, vacío si no aparece" },
    tipoEntrada: { type: "string", enum: ["gratis", "pago", "lista"] },
    precio: { type: "string", description: "Precio en euros solo el número, vacío si es gratis o no aparece" },
    revisar: {
      type: "array",
      items: { type: "string" },
      description: "Nombres de los campos con baja confianza que el humano debe revisar",
    },
  },
  required: ["titulo", "fecha", "horaInicio", "horaFin", "dj", "estilo", "tipoEntrada", "precio", "revisar"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en el servidor (.env.local)." },
      { status: 500 }
    );
  }

  let body: { imageBase64?: string; mediaType?: string; accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  // Solo locales dados de alta (o admin): esta ruta gasta créditos de IA.
  const auth = await autorizarLocalOAdmin(body.accessToken);
  if (auth instanceof NextResponse) return auth;
  if (!(await pasaLimite(`leer:${auth.uid}`, LECTURAS_POR_HORA))) return respuestaLimite("lecturas de flyer");

  if (!body.imageBase64) {
    return NextResponse.json({ error: "Falta la imagen del flyer." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      // Salida estructurada: la respuesta cumple el esquema
      output_config: { format: { type: "json_schema", schema } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: (body.mediaType as "image/jpeg" | "image/png") || "image/jpeg",
                data: body.imageBase64,
              },
            },
            {
              type: "text",
              text:
                "Este es el flyer de un 'tardeo' (fiesta de tarde en España). Extrae los datos al JSON del esquema. " +
                "Fecha en YYYY-MM-DD y horas en HH:MM (24h). Si un dato no aparece, déjalo vacío. " +
                "tipoEntrada: 'pago' si hay precio, 'lista' si menciona lista de invitados, si no 'gratis'. " +
                "En 'revisar' pon los campos de los que NO estés seguro (especialmente fecha y hora si son ambiguas).",
            },
          ],
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);

    const textBlock = msg.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "{}";
    return NextResponse.json({ data: JSON.parse(text) });
  } catch (e: unknown) {
    registrar("leer-flyer", "no se pudo leer el flyer", e);
    // El detalle al log, y a la pantalla algo
    // en español que el dueño de un bar pueda entender.
    const err = e as { status?: number };
    const message =
      err?.status === 429 || err?.status === 529
        ? "La IA está saturada ahora mismo. Prueba dentro de un minuto."
        : err?.status === 401 || err?.status === 403
          ? "La IA no está bien configurada. Avisa a TardeosClub."
          : "No se ha podido leer el flyer. Prueba con otra imagen o rellénalo a mano.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
