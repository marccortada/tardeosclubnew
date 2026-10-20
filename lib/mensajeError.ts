/**
 * Error (de Supabase, de fetch o lo que sea) → frase corta para la persona.
 *
 * Por qué existe: en varias pantallas llegaba al usuario el `err.message` tal
 * cual («Failed to fetch», «JWT expired», «new row violates row-level security
 * policy…»). Eso asusta y no dice qué hacer. Aquí se traducen los casos
 * típicos; los mensajes que ya están en español (los lanzan nuestras funciones
 * de la base, p. ej. «Ese tardeo ya está cerrado») se dejan pasar porque son
 * los que mejor explican el problema.
 */
const SIN_CONEXION = "Sin conexión. Revisa internet y vuelve a intentarlo.";
const SESION_CADUCADA = "Tu sesión ha caducado. Vuelve a entrar.";
const SIN_PERMISO = "No tienes permiso para hacer esto.";
const GENERICO = "Algo ha fallado. Vuelve a intentarlo.";

// Palabras muy frecuentes en español y raras en los mensajes técnicos en inglés.
// «no» se deja fuera a propósito: «No rows returned» es inglés.
const PALABRAS_ES = /\b(de|del|el|la|los|las|ya|para|con|que|tu|su|este|esta|ese|esa|puedes|hay|sin|una|un|se|lo)\b/gi;

function pareceEspanol(texto: string): boolean {
  if (/[áéíóúñ¿¡]/i.test(texto)) return true;
  // Sin tildes, al menos dos palabras típicas (una sola puede ser casualidad).
  return (texto.match(PALABRAS_ES) ?? []).length >= 2;
}

export function mensajeAmable(err: unknown): string {
  if (err == null) return GENERICO;
  const e = (typeof err === "object" ? err : { message: String(err) }) as {
    message?: unknown; code?: unknown; status?: unknown; name?: unknown;
  };
  const mensaje = typeof e.message === "string" ? e.message : typeof err === "string" ? err : "";
  const codigo = e.code != null ? String(e.code) : "";
  const estado = typeof e.status === "number" ? e.status : null;
  const nombre = typeof e.name === "string" ? e.name : "";

  if (/failed to fetch|networkerror|network request failed|load failed|timeout|timed out|aborted/i.test(mensaje)
    || nombre === "AbortError" || nombre === "TimeoutError") {
    return SIN_CONEXION;
  }
  if (codigo === "PGRST301" || estado === 401 || /jwt expired|invalid jwt|jwt/i.test(mensaje)) {
    return SESION_CADUCADA;
  }
  if (codigo === "42501" || estado === 403 || /permission denied|row-level security/i.test(mensaje)) {
    return SIN_PERMISO;
  }
  if (mensaje && pareceEspanol(mensaje)) return mensaje;
  return GENERICO;
}
