import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 120;

// ---------- El "toque TardeosClub" + normas de seguridad ----------
const SISTEMA_MARCA = `Eres el diseñador de flyers de TardeosClub. Conviertes la petición de un local en un PROMPT detallado (en español) para un generador de imágenes, SIEMPRE con el estilo de la marca y respetando las normas.

ESTILO TARDEOSCLUB (obligatorio en TODOS los flyers):
- Cartel/flyer VERTICAL tipo póster, moderno, vibrante y festivo.
- Ambiente de "tardeo" (fiesta de tarde/noche): terrazas, chiringuitos, playa, piscina o sala; gente adulta disfrutando con alegría, manos arriba, buen rollo, cócteles, música, DJ en cabina.
- Paleta de marca SIEMPRE presente: magenta intenso (#E10A5A) y dorado (#F5B301). Alto contraste, tipografía grande e impactante.
- Elegante pero desenfadado, energía positiva y cercana.

VARIEDAD Y CREATIVIDAD (muy importante — NO todos los flyers son iguales):
- La luz y el ambiente DEBEN adaptarse a la HORA del tardeo, NO uses siempre atardecer:
  · Mediodía / mañana: luz brillante de día, cielo azul, piscina, playa o terraza a pleno sol.
  · Primera hora de la tarde: luz cálida y soleada.
  · Sobre el atardecer: golden hour, cielos naranjas y rosas.
  · Noche: neón, focos de colores, láser, ambiente de club/sala.
- Varía también el escenario, el encuadre y la composición según el estilo musical y la petición, para que cada flyer sea distinto y original.
- El magenta y el dorado de la marca se mantienen siempre, pero el resto de la escena cambia con la hora y el estilo.

NORMAS OBLIGATORIAS (seguridad):
- PROHIBIDO: contenido sexual, desnudos o insinuaciones sexuales; menores; violencia, armas o drogas; imágenes morbosas, perturbadoras o extrañas; texto ofensivo, vulgar o discriminatorio.
- Las personas se representan de forma respetuosa y con clase, NUNCA sexualizada ni vulgar.
- Si la petición incluye algo prohibido, IGNÓRALO y crea un flyer de marca normal. Si TODA la petición es inapropiada, pon bloqueado=true y explica por qué en motivo.
- Deja una esquina inferior algo despejada para un sello.

En 'prompt' describe escena, composición y colores, e indica EXACTAMENTE qué texto poner (título, DJ, fecha) para que se escriba sin faltas. Devuelve SOLO el JSON del esquema.`;

const promptSchema = {
  type: "object",
  properties: {
    prompt: { type: "string", description: "Prompt de imagen en español, de marca y seguro" },
    bloqueado: { type: "boolean", description: "true si la petición es inapropiada y no se debe generar" },
    motivo: { type: "string", description: "Motivo si está bloqueado, vacío si no" },
    datos: {
      type: "object",
      description: "Datos del evento extraídos de la descripción del local. Deja '' lo que no se indique.",
      properties: {
        titulo: { type: "string", description: "Título del tardeo si se puede inferir, si no ''" },
        fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD. Si no hay año, usa el próximo desde hoy. '' si no se indica." },
        horaInicio: { type: "string", description: "Hora de inicio HH:MM (24h) o ''" },
        horaFin: { type: "string", description: "Hora de fin HH:MM (24h) o ''" },
        dj: { type: "string", description: "Nombre(s) de DJ o ''" },
        estilo: { type: "string", description: "Estilo musical o ''" },
        tipoEntrada: { type: "string", enum: ["gratis", "pago", "lista"], description: "gratis si no se indica" },
        precio: { type: "string", description: "Precio en € solo si es de pago, si no ''" },
      },
      required: ["titulo", "fecha", "horaInicio", "horaFin", "dj", "estilo", "tipoEntrada", "precio"],
      additionalProperties: false,
    },
  },
  required: ["prompt", "bloqueado", "motivo", "datos"],
  additionalProperties: false,
};

/** Ambiente/luz según la hora del tardeo (para que no todos sean "atardecer"). */
function ambientePorHora(hora: string): string {
  const h = parseInt((hora || "").slice(0, 2), 10);
  if (isNaN(h)) return "ambiente de tardeo con luz cálida y festiva";
  if (h < 13) return "mediodía a pleno sol: luz brillante de día, cielo azul, terraza/piscina/playa, ambiente diurno";
  if (h < 17) return "primera hora de la tarde: luz cálida y soleada, terraza animada";
  if (h < 20) return "atardecer dorado (golden hour): cielo naranja y rosa, siluetas cálidas";
  if (h < 23) return "anochecer: cielo violeta con primeras luces de neón y focos de colores";
  return "noche: ambiente de club/sala con luces de colores, focos y láser, energía nocturna";
}

function promptBase(titulo: string, fecha: string, dj: string, estilo: string, descripcion: string, hora: string) {
  return (
    `Cartel/flyer VERTICAL para un "tardeo" (fiesta en España). Estilo festivo y moderno, ` +
    `paleta de marca magenta (#E10A5A) y dorado (#F5B301). Ambiente: ${ambientePorHora(hora)}, con gente adulta disfrutando, DJ y buen rollo. ` +
    (titulo ? `Título grande y legible: "${titulo}". ` : ``) +
    (estilo ? `Estilo musical: ${estilo}. ` : ``) +
    (dj ? `DJ(s): ${dj}. ` : ``) +
    (fecha ? `Fecha: ${fecha}. ` : ``) +
    (hora ? `Hora de inicio: ${hora}. ` : ``) +
    (descripcion ? `${descripcion}. ` : ``) +
    `Composición tipo póster, tipografía impactante, texto en español sin faltas, elegante y respetuoso. ` +
    `Sin contenido sexual, sin desnudos, sin nada desagradable. Deja una esquina inferior despejada para un sello.`
  );
}

export async function POST(req: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "Falta OPENAI_API_KEY en el servidor." }, { status: 500 });
  }

  let body: { descripcion?: string; titulo?: string; fecha?: string; dj?: string; estilo?: string; hora?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const { descripcion = "", titulo = "", fecha = "", dj = "", estilo = "", hora = "" } = body;

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

  // 1) Claude crea un prompt de marca y seguro (y bloquea lo inapropiado) + extrae los datos
  let prompt = promptBase(titulo, fecha, dj, estilo, descripcion, hora);
  let datos: Record<string, string> | null = null;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const claude = new Anthropic({ apiKey: anthropicKey });
      const msg = await claude.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 900,
        system: SISTEMA_MARCA,
        output_config: { format: { type: "json_schema", schema: promptSchema } },
        messages: [
          {
            role: "user",
            content:
              `Hoy es ${hoy}. Datos del tardeo — título: "${titulo}", estilo: "${estilo}", DJ: "${dj}", fecha: "${fecha}", hora de inicio: "${hora}". ` +
              `Adapta la luz y el ambiente a esa hora (no uses atardecer si no toca) y sé creativo para que el flyer sea único. ` +
              `Petición del local: "${descripcion}". ` +
              `Genera el prompt de imagen de marca Y rellena "datos" extrayendo de la petición lo que puedas (fecha, horas, DJ, estilo, tipo de entrada, precio). ` +
              `Para fechas sin año usa el próximo desde hoy (${hoy}). Deja "" lo que no se indique.`,
          },
        ],
      } as Anthropic.MessageCreateParamsNonStreaming);
      const tb = msg.content.find((b) => b.type === "text");
      const parsed = tb && "text" in tb ? JSON.parse(tb.text) : null;
      if (parsed?.bloqueado) {
        return NextResponse.json(
          { error: "Esa descripción no está permitida: " + (parsed.motivo || "contenido inapropiado.") },
          { status: 400 }
        );
      }
      if (parsed?.prompt) prompt = parsed.prompt;
      if (parsed?.datos) datos = parsed.datos;
    } catch {
      // si Claude falla, seguimos con el prompt base (ya lleva marca + seguridad)
    }
  }

  // 2) gpt-image-1 genera (con moderación automática de OpenAI)
  const openai = new OpenAI({ apiKey: openaiKey });
  try {
    const res = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1536",
      quality: "medium",
      moderation: "auto",
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("El generador no devolvió imagen.");
    const genBuf = Buffer.from(b64, "base64");

    // 3) Sello oficial por código
    const selloRaw = await readFile(path.join(process.cwd(), "public/branding/sello.png"));
    const sello = await sharp(selloRaw)
      .resize(280)
      .extend({ top: 0, left: 0, bottom: 48, right: 48, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const final = await sharp(genBuf)
      .composite([{ input: sello, gravity: "southeast" }])
      .jpeg({ quality: 90 })
      .toBuffer();

    return NextResponse.json({ image: final.toString("base64"), datos });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al generar el flyer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
