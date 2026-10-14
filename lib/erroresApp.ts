/**
 * Piezas comunes de los errores automáticos (lote 57, tabla `errores_app`).
 *
 * Lo usan el navegador (para no mandar dos veces lo mismo), la ruta
 * /api/errores y `registrar` en el servidor. Sin dependencias: se importa
 * desde cliente y servidor sin arrastrar nada.
 */

export type DatosError = {
  mensaje: string;
  pila?: string | null;
  url?: string | null;
  ruta?: string | null;
  origen: "cliente" | "servidor";
  userAgent?: string | null;
  profileId?: string | null;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Recorta sin romper si llega algo que no es texto. */
export const recortar = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/**
 * La ruta sin ids ni consulta: /tardeos/3f2a…/editar → /tardeos/:id/editar.
 * Sin esto, el mismo fallo en cien tardeos serían cien filas.
 */
export function rutaGenerica(url: string | null | undefined): string | null {
  if (!url) return null;
  let p = url;
  try { p = new URL(url, "http://x").pathname; } catch { /* se usa tal cual */ }
  return p.replace(UUID, ":id").replace(/\/\d+(?=\/|$)/g, "/:n").slice(0, 300) || "/";
}

/**
 * Mensaje sin lo que cambia de un caso a otro (ids, números, URLs), para que
 * el mismo error agrupe en una sola fila.
 */
const normalizar = (m: string) =>
  m.replace(UUID, ":id").replace(/https?:\/\/\S+/g, ":url").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 300);

/**
 * Huella del error: FNV-1a de 64 bits (dos de 32) en hexadecimal. No es
 * criptográfica ni falta que hace: solo agrupa. Va escrita a mano para poder
 * usarla igual en el navegador y en el servidor sin `node:crypto`.
 */
export function huella(origen: string, mensaje: string, ruta: string | null): string {
  const s = `${origen}|${normalizar(mensaje)}|${ruta ?? ""}`;
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/**
 * Guarda (o suma +1) en `errores_app` con la service role. SOLO SERVIDOR.
 *
 * Va con `fetch` directo a PostgREST y no con supabase-js para que
 * `lib/registro.ts` pueda llamarla sin importar nada. NUNCA lanza y NUNCA
 * llama a `registrar`: si guardar el error falla, no puede generar otro error
 * que intente guardarse (bucle).
 */
export async function guardarErrorServidor(d: DatosError): Promise<boolean> {
  try {
    if (typeof window !== "undefined") return false;
    // En desarrollo no se guarda nada: el ordenador del programador apunta a
    // la base de producción y llenaría Errores con fallos de recarga en
    // caliente. Para probarlo en local: ERRORES_EN_DESARROLLO=true.
    if (process.env.NODE_ENV !== "production" && process.env.ERRORES_EN_DESARROLLO !== "true") return false;
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!URL || !KEY) return false;
    const mensaje = recortar(d.mensaje, 1000);
    if (!mensaje) return false;
    const ruta = recortar(d.ruta, 300) ?? rutaGenerica(d.url);
    const r = await fetch(`${URL}/rest/v1/rpc/registrar_error_app`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_huella: huella(d.origen, mensaje, ruta),
        p_mensaje: mensaje,
        p_pila: recortar(d.pila, 4000),
        p_url: recortar(d.url, 500),
        p_ruta: ruta,
        p_origen: d.origen,
        p_user_agent: recortar(d.userAgent, 400),
        p_profile: d.profileId && /^[0-9a-f-]{36}$/i.test(d.profileId) ? d.profileId : null,
      }),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  }
}
