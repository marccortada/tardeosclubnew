/**
 * "Volver a donde ibas" tras entrar.
 *
 * Quien pulsa "Entrar" desde /local, /dj o /admin acaba en /perfil para
 * iniciar sesión; sin esto, al entrar se quedaba en "Mi cuenta" y tenía que
 * buscar otra vez su panel. Se pasa como `/perfil?volver=/local`.
 *
 * Solo rutas internas ("/algo", nunca "//host" ni "/\host"): un `volver`
 * externo convertiría el acceso en un redirector abierto.
 */
export function volverSeguro(v: string | null | undefined): string | null {
  if (!v || v.length > 500 || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  // Caracteres de control y barras invertidas: el navegador los descarta al
  // leer la URL, y "/<tab>/evil.com" acabaría siendo "//evil.com".
  if (/[\u0000-\u001f\\]/.test(v)) return null;
  // Y la prueba definitiva: resuelta contra nuestro origen, tiene que seguir
  // siendo nuestro origen.
  if (typeof window !== "undefined") {
    try {
      if (new URL(v, window.location.origin).origin !== window.location.origin) return null;
    } catch { return null; }
  }
  return v;
}

export function leerVolver(): string | null {
  if (typeof window === "undefined") return null;
  return volverSeguro(new URLSearchParams(window.location.search).get("volver"));
}

/** Enlace a /perfil que, tras entrar, devuelve a `ruta`. */
export const entrarYVolver = (ruta: string) => `/perfil?volver=${encodeURIComponent(ruta)}`;

/**
 * La URL solo si es de nuestra propia web; si no, null. Para pintar como
 * enlace direcciones que vienen de fuera (incidencias y errores las manda
 * cualquiera): una URL ajena se enseña como texto, nunca como enlace en el
 * que el admin pueda caer.
 */
export function enlacePropio(url: string | null | undefined): string | null {
  if (!url || typeof window === "undefined") return null;
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin ? u.href : null;
  } catch {
    return null;
  }
}
