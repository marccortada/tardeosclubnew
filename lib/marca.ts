/**
 * Nombre y datos de marca en UN sitio: el cliente puede cambiar de nombre
 * (decisión pendiente desde el 18-oct-2026). Todo texto visible que diga el
 * nombre de la app (títulos, metadatos, emails, textos para compartir, avisos
 * legales, alt de logos, JSON-LD) sale de aquí.
 *
 * Qué más hay que tocar si cambia la marca: docs/CAMBIO_DE_MARCA.md.
 *
 * Sin "server-only" a propósito: lo importan también componentes de cliente.
 */
export const MARCA = {
  /** Nombre comercial tal como se escribe en la interfaz. */
  nombre: "TardeosClub",
  /** Dominio público, sin protocolo. Solo para textos y valores por defecto:
   *  la URL real del sitio sigue llegando por NEXT_PUBLIC_SITE_URL. */
  dominio: "tardeosclub.com",
  /** Coletilla que se repite en metadatos y pies de email. */
  lema: "Sal, conecta y vive el tardeo.",
} as const;
