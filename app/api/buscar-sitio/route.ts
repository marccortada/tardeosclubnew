import { NextResponse } from "next/server";
import { autorizarUsuario, pasaLimite, respuestaLimite } from "@/lib/apiAuth";
import { registrar, avisar } from "@/lib/registro";

export const runtime = "nodejs";

/**
 * Busca un sitio por su nombre o por su calle, desde el SERVIDOR.
 *
 * Va por aquí y no desde el navegador a propósito: una clave de Google usada
 * en el navegador la ve cualquiera que abra el inspector, y la única defensa
 * es restringirla por dominio, que se falsifica sin esfuerzo. Aquí la clave se
 * queda en el .env del servidor y la clave está además atada a la IP del
 * droplet, así que ni filtrándose serviría desde otro sitio.
 *
 * Google cobra por petición, de ahí las dos defensas:
 *  - hay que tener sesión iniciada (no exige local: la dirección se pide en el
 *    propio alta, cuando la ficha todavía no existe);
 *  - tope por usuario y hora, con el mismo contador que usan las rutas de IA.
 *
 * Si no hay clave puesta (por ejemplo en local, donde la restricción por IP
 * la bloquearía igualmente) cae a OpenStreetMap, que es gratis y tiene todas
 * las calles aunque le falten bares. Así el alta nunca se queda sin buscador.
 */

// Crear un tardeo son dos o tres búsquedas. 60 deja margen de sobra para
// corregirse y sigue siendo un techo si alguien se pone a darle sin parar.
const BUSQUEDAS_POR_HORA = 60;

export type Sitio = {
  display: string;
  lat: number;
  lng: number;
  cp: string;
  zona: string;
};

/** De los trozos de dirección de Google saca el CP y el municipio. */
function trocear(componentes: any[] = []) {
  const buscar = (...tipos: string[]) =>
    componentes.find((c) => tipos.some((t) => c.types?.includes(t)))?.longText ?? "";
  return {
    cp: buscar("postal_code"),
    zona:
      buscar("locality") ||
      buscar("postal_town") ||
      buscar("administrative_area_level_3") ||
      buscar("administrative_area_level_2") ||
      buscar("administrative_area_level_1"),
  };
}

async function conGoogle(q: string, key: string): Promise<Sitio[]> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      // Google cobra según los campos que pidas. Estos cuatro son todos del
      // mismo tramo, así que pedirlos juntos cuesta lo mismo que pedir uno.
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: "es",
      regionCode: "ES",
      maxResultCount: 6,
    }),
  });

  if (!r.ok) {
    const detalle = await r.text();
    throw new Error(`Google ${r.status}: ${detalle.slice(0, 300)}`);
  }

  const j = await r.json();
  return (j.places ?? []).map((p: any) => {
    const { cp, zona } = trocear(p.addressComponents);
    const nombre = p.displayName?.text ?? "";
    const dir = p.formattedAddress ?? "";
    return {
      // El nombre delante: quien busca "Sala Miracle" quiere reconocerlo de un
      // vistazo, no leerse la calle para saber si es el suyo.
      display: nombre && !dir.startsWith(nombre) ? `${nombre} · ${dir}` : dir || nombre,
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      cp,
      zona,
    };
  });
}

async function conOsm(q: string): Promise<Sitio[]> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=es&q=${encodeURIComponent(q)}`,
    // Nominatim pide identificarse; sin User-Agent responde 403.
    { headers: { "Accept-Language": "es", "User-Agent": "TardeosClub (info@gnerai.com)" } }
  );
  if (!r.ok) throw new Error(`OSM ${r.status}`);
  const j = await r.json();
  return (j ?? []).map((x: any) => ({
    display: x.display_name,
    lat: +x.lat,
    lng: +x.lon,
    cp: x.address?.postcode ?? "",
    zona:
      x.address?.city || x.address?.town || x.address?.village ||
      x.address?.municipality || x.address?.county || x.address?.state || "",
  }));
}

export async function POST(req: Request) {
  const { q, accessToken } = await req.json().catch(() => ({}) as any);

  const texto = (q ?? "").trim();
  if (texto.length < 3) {
    return NextResponse.json({ error: "Escribe al menos tres letras." }, { status: 400 });
  }

  const auth = await autorizarUsuario(accessToken);
  if (auth instanceof NextResponse) return auth;

  if (!(await pasaLimite(`sitio:${auth.uid}`, BUSQUEDAS_POR_HORA))) {
    return respuestaLimite("búsquedas de dirección");
  }

  const key = process.env.GOOGLE_PLACES_KEY;

  if (key) {
    try {
      return NextResponse.json({ fuente: "google", resultados: await conGoogle(texto, key) });
    } catch (e: any) {
      // No se traga el fallo en silencio: si la clave está mal puesta o sin
      // saldo, aquí es donde se ve. El usuario sigue pudiendo buscar por calle.
      avisar("buscar-sitio", "Google falló; se prueba con OpenStreetMap", e);
    }
  }

  try {
    return NextResponse.json({ fuente: "osm", resultados: await conOsm(texto) });
  } catch (e: any) {
    registrar("buscar-sitio", "OpenStreetMap también falló: no hay búsqueda de direcciones", e);
    return NextResponse.json({ error: "El buscador de direcciones no responde ahora mismo." }, { status: 502 });
  }
}

/**
 * Solo dice si el servidor tiene clave de Google puesta. Nunca el valor.
 *
 * Existe porque el fallo más probable es mudo: sin clave la ruta cae a
 * OpenStreetMap y sigue devolviendo resultados, así que nadie se entera de que
 * se está buscando con el buscador malo. Con esto se ve de un vistazo.
 */
export async function GET() {
  return NextResponse.json({
    clave: !!process.env.GOOGLE_PLACES_KEY,
    buscador: process.env.GOOGLE_PLACES_KEY ? "google" : "openstreetmap",
  });
}
