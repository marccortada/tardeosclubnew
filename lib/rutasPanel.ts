/**
 * Rutas que se pintan dentro de un panel con barra lateral (PanelShell).
 * En ellas sobran la cabecera pública (SiteNav) y la barra de abajo (BottomNav):
 * el panel trae su propia navegación.
 *
 * OJO: /dj/<slug> es la ficha pública antigua de un DJ (redirige), no el panel.
 * Por eso del DJ solo cuentan /dj y sus secciones conocidas.
 */
const SECCIONES_DJ = ["perfil", "contenido", "presskit", "tardeos", "resenas", "ayuda"];

/** Secciones de "Mi cuenta" que solo existen con sesión. */
const CUENTA = ["/perfil/gustos", "/perfil/reservas", "/perfil/notificaciones", "/perfil/ajustes"];

export function esRutaPanel(pathname: string): boolean {
  if (CUENTA.some((r) => pathname === r || pathname.startsWith(r + "/"))) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/local" || pathname.startsWith("/local/")) return true;
  if (pathname === "/dj") return true;
  const m = pathname.match(/^\/dj\/([^/]+)/);
  return !!m && SECCIONES_DJ.includes(m[1]);
}

/**
 * La barra de abajo (móvil) solo se quita en el admin, que es una herramienta
 * de trabajo con su propio menú. En el panel del local y del DJ se queda: son
 * usuarios de la web que también gestionan algo, y quitarles la barra les
 * dejaba "en un sitio raro" sin forma evidente de volver a Inicio o Tardeos.
 */
export function ocultaBarraInferior(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * /perfil y /favoritos son panel SOLO con sesión (sin ella, /perfil es la
 * pantalla de acceso, que lleva la cabecera de la web).
 */
export function esRutaPanelConSesion(pathname: string): boolean {
  return pathname === "/perfil" || pathname === "/favoritos";
}
