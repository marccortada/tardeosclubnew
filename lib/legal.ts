/**
 * Datos del responsable del tratamiento.
 *
 * Según ANALISIS.md §17.12: la entidad legal (autónomo o S.L.) todavía NO está
 * constituida, así que los textos se publican con el nombre comercial y con
 * hueco para el NIF/CIF. En cuanto el dueño lo confirme, se rellena AQUÍ y las
 * tres páginas legales quedan actualizadas.
 */
export const RESPONSABLE = {
  nombreComercial: "TardeosClub",
  /** Razón social. Vacío = aún sin constituir (ver PEDIR_AL_DUENO.md §3). */
  razonSocial: "",
  /** NIF / CIF. Vacío = pendiente. */
  nif: "",
  /** Domicilio fiscal. Vacío = pendiente. */
  domicilio: "",
  emailContacto: "hola@tardeosclub.com",
  emailPrivacidad: "privacidad@tardeosclub.com",
};

export const ULTIMA_ACTUALIZACION = "31 de julio de 2026";

/** Proveedores que tratan datos por cuenta de TardeosClub (ANALISIS.md §17.8). */
export const SUBENCARGADOS = [
  { nombre: "Supabase", uso: "Base de datos y acceso a la cuenta", donde: "Unión Europea" },
  { nombre: "Google", uso: "Entrar con tu cuenta de Google, si eliges esa opción", donde: "EE. UU. (con garantías RGPD)" },
  { nombre: "DigitalOcean", uso: "Alojamiento de la web", donde: "Unión Europea" },
  { nombre: "Cloudflare", uso: "Red de distribución y seguridad", donde: "Global (con garantías RGPD)" },
  { nombre: "Anthropic (Claude)", uso: "Leer los flyers que sube el local", donde: "EE. UU." },
  { nombre: "OpenAI", uso: "Generar imágenes de flyer", donde: "EE. UU." },
  { nombre: "Resend", uso: "Envío de emails y recordatorios", donde: "EE. UU." },
  { nombre: "Fourvenues", uso: "Venta de entradas y listas", donde: "Según su propia política" },
];
