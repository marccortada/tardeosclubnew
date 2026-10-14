"use client";

import { supabase } from "./supabase";
import { huella, rutaGenerica } from "./erroresApp";

/**
 * Manda un error del navegador a /api/errores (que lo guarda en el lote 57).
 *
 * Con antirrebote, porque un error dentro de un render o de un intervalo se
 * repite cientos de veces por segundo:
 *  - como mucho 5 envíos por pestaña (hasta recargar);
 *  - la misma huella, una vez por minuto.
 * Y se ignora el ruido que no es nuestro: extensiones del navegador,
 * ResizeObserver (aviso benigno de Chrome) y los «Script error.» sin datos
 * de scripts de otros dominios.
 */
const MAX_POR_PESTANA = 5;
let enviados = 0;
const ultimos = new Map<string, number>();

const RUIDO = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /(chrome|moz|safari(-web)?)-extension:\/\//i,
  /webkit-masked-url/i,
  // Fallos de red del propio visitante: no los podemos arreglar.
  /^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/i,
];

export function esRuido(mensaje: string, pila?: string | null, archivo?: string | null): boolean {
  const todo = `${mensaje}\n${pila ?? ""}\n${archivo ?? ""}`;
  return RUIDO.some((r) => r.test(mensaje) || r.test(todo));
}

/** Convierte cualquier cosa lanzada en mensaje + pila. */
export function describir(e: unknown): { mensaje: string; pila: string | null } {
  if (e instanceof Error) {
    const digest = (e as Error & { digest?: string }).digest;
    return { mensaje: `${e.name}: ${e.message}${digest ? ` (digest ${digest})` : ""}`, pila: e.stack ?? null };
  }
  if (typeof e === "string") return { mensaje: e, pila: null };
  try { return { mensaje: JSON.stringify(e).slice(0, 500), pila: null }; } catch { return { mensaje: String(e), pila: null }; }
}

export async function enviarError(e: unknown, archivo?: string | null): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    const { mensaje, pila } = describir(e);
    if (!mensaje || esRuido(mensaje, pila, archivo)) return;
    if (enviados >= MAX_POR_PESTANA) return;

    const url = window.location.href;
    const h = huella("cliente", mensaje, rutaGenerica(url));
    const ahora = Date.now();
    if (ahora - (ultimos.get(h) ?? 0) < 60_000) return;
    ultimos.set(h, ahora);
    enviados++;

    // La sesión se lee de memoria/almacenamiento local: no hace petición.
    let token: string | undefined;
    try { token = (await supabase.auth.getSession()).data.session?.access_token; } catch { /* sin sesión */ }

    const cuerpo = JSON.stringify({
      mensaje: mensaje.slice(0, 1000),
      pila: pila?.slice(0, 4000) ?? null,
      url: url.slice(0, 500),
      token,
    });
    // keepalive: si el error tumba la página o el usuario se va, el envío sigue.
    await fetch("/api/errores", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo, keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* informar de un error nunca puede provocar otro */
  }
}
