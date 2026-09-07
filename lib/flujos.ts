/**
 * El catálogo de flujos que hay que dejar grabados (E-15 / B-12).
 *
 * Tardeos Club no pide «unos vídeos»: pide evidencias por FLUJO, ROL, ENTORNO
 * y VERSIÓN, ordenadas y reutilizables como manual. Y en su apartado 4.2 dice
 * qué NO acepta como cierre, que es la parte que de verdad manda:
 *
 *   · «ya está hecho» sin versión, entorno, evidencia y criterio;
 *   · una captura estática cuando el requisito describe un recorrido;
 *   · un botón oculto sin permiso real en el servidor;
 *   · una corrección manual de datos sin resolver la causa;
 *   · una función probada únicamente con Admin.
 *
 * De ahí salen las dos reglas de este catálogo, y las dos son incómodas a
 * propósito:
 *
 *   1. Cada flujo dice CON QUÉ ROL se graba. Los dos últimos puntos de su
 *      lista son el mismo error: probar todo como admin. Un admin lo puede
 *      todo, así que grabando con él no se demuestra ningún permiso.
 *   2. Cada flujo lleva su CASO NEGATIVO. Un vídeo donde todo sale bien no
 *      prueba que exista una comprobación; prueba que no hizo falta. Lo que
 *      demuestra que el permiso existe es verlo denegar.
 *
 * Esto es la lista de la compra de la grabación. No graba nada: hace que
 * grabar sea mecánico y que dos personas distintas graben lo mismo.
 */

export type Rol = "visitante" | "tardicola" | "local" | "promotor" | "dj" | "admin";

export const ROLES: Record<Rol, string> = {
  visitante: "Sin cuenta",
  tardicola: "Tardícola con cuenta",
  local: "Local",
  promotor: "Promotor",
  dj: "DJ",
  admin: "Administración",
};

export type Flujo = {
  /** Código del requisito al que responde, para no duplicar tareas. */
  codigo: string;
  titulo: string;
  rol: Rol;
  /** Dónde empieza. Ruta relativa. */
  entrada: string;
  /** Los pasos, en el orden en que se graban. */
  pasos: string[];
  /** Qué tiene que verse para que valga. Si no se ve, el vídeo no sirve. */
  seVe: string[];
  /**
   * El caso negativo: qué se hace para que FALLE, y qué debe pasar.
   * `null` solo cuando el flujo no tiene forma de fallar.
   */
  negativo: string | null;
};

export const FLUJOS: Flujo[] = [
  // ---------- Visitante ----------
  {
    codigo: "E-04",
    titulo: "Encontrar un plan para el sábado",
    rol: "visitante",
    entrada: "/tardeos",
    pasos: [
      "Pulsar «Sábado» en la fila de arriba",
      "Comprobar que la fecha de la pastilla coincide con el próximo sábado",
      "Abrir uno de los resultados",
      "Volver atrás y comprobar que el filtro sigue puesto",
    ],
    seVe: ["La fecha bajo cada día", "El recuento cambiando al filtrar", "El filtro conservado al volver"],
    negativo: "Elegir un día sin tardeos: debe salir el mensaje de lista vacía, no una pantalla en blanco.",
  },
  {
    codigo: "A-07",
    titulo: "Añadir un tardeo al calendario",
    rol: "visitante",
    entrada: "/tardeos/[id]",
    pasos: [
      "Abrir un tardeo que ACABE DE MADRUGADA (por ejemplo de 22:00 a 02:00)",
      "Pulsar «Añadir al calendario»",
      "En Google Calendar, comprobar el día y la hora de fin",
    ],
    seVe: ["La hora de fin al día SIGUIENTE", "La hora en horario de España"],
    negativo: null,
  },
  {
    codigo: "E-07",
    titulo: "Cómo llegar y cómo volver",
    rol: "visitante",
    entrada: "/tardeos/[id]",
    pasos: ["Bajar hasta el mapa", "Pulsar «Cómo llegar»", "Volver y pulsar «Pedir taxi»"],
    seVe: ["El aviso de vuelta segura bajo los dos botones", "Los taxis buscados cerca del sitio"],
    negativo: null,
  },
  {
    codigo: "A-13",
    titulo: "Contactar con un local desde su ficha",
    rol: "visitante",
    entrada: "/locales/[id]",
    pasos: ["Abrir un local con Instagram", "Pulsar el botón de Instagram", "Volver y pulsar WhatsApp"],
    seVe: ["El enlace de Instagram sin parámetros de seguimiento", "Un solo botón cuando dos campos apuntan al mismo sitio"],
    negativo: "Un local sin redes: no debe salir ningún botón vacío.",
  },
  {
    codigo: "Q-01",
    titulo: "Denunciar un flyer sin tener cuenta",
    rol: "visitante",
    entrada: "/tardeos/[id]",
    pasos: ["Bajar al final", "Pulsar «Avisar de un problema con este flyer»", "Elegir motivo y enviar"],
    seVe: ["Que NO pide iniciar sesión", "El acuse de recibo"],
    negativo: "Enviar sin elegir motivo: el botón debe estar desactivado.",
  },

  // ---------- Tardícola ----------
  {
    codigo: "A-14",
    titulo: "Darse de alta y elegir si quiere ofertas",
    rol: "tardicola",
    entrada: "/perfil",
    pasos: ["Crear la cuenta con la casilla de ofertas marcada", "Entrar en el perfil", "Desmarcarla", "Recargar"],
    seVe: ["La casilla en el alta", "Que el cambio persiste tras recargar"],
    negativo: null,
  },
  {
    codigo: "Q-05",
    titulo: "Escribir una reseña y apelar un rechazo",
    rol: "tardicola",
    entrada: "/locales/[id]",
    pasos: [
      "Escribir una reseña",
      "Que Administración la rechace con un motivo (se graba aparte)",
      "Volver a la ficha con la MISMA cuenta",
      "Leer el motivo y pedir que la revisen",
    ],
    seVe: ["El motivo del rechazo, escrito", "El acuse tras apelar"],
    negativo: "Intentar escribir una segunda reseña del mismo sitio: la base la rechaza.",
  },

  // ---------- Local ----------
  {
    codigo: "A-12",
    titulo: "Añadir el enlace de entradas a un tardeo ya publicado",
    rol: "local",
    entrada: "/local",
    pasos: [
      "Abrir un tardeo ya creado y darle a editar",
      "Pegar el enlace de la ticketera",
      "Guardar y abrir la ficha pública",
    ],
    seVe: ["El botón de comprar en la ficha pública", "Que el enlace guardado se conserva al reabrir el editor"],
    negativo: null,
  },
  {
    codigo: "TC-007",
    titulo: "Crear un tardeo que se repite",
    rol: "local",
    entrada: "/local/crear",
    pasos: [
      "Poner fecha y elegir «Cada semana»",
      "Pulsar el atajo de 3 meses",
      "Leer la lista de fechas",
      "Avanzar hasta el último paso",
    ],
    seVe: ["«Se crearán N tardeos» con las fechas", "El botón diciendo «Publicar N tardeos»"],
    negativo: "Elegir «cada semana» sin poner el hasta: debe avisar al publicar.",
  },
  {
    codigo: "A-13",
    titulo: "Completar la ficha del local",
    rol: "local",
    entrada: "/local/editar",
    pasos: ["Rellenar Instagram, web, reservas y email", "Guardar", "Abrir la ficha pública"],
    seVe: ["Los botones nuevos en la ficha", "Que el email NO sale en público"],
    negativo: "Escribir «@mi local» con espacio: debe avisar de que no se entiende.",
  },
  {
    codigo: "A-09",
    titulo: "Ficha pendiente de aprobar",
    rol: "local",
    entrada: "/local",
    pasos: ["Entrar con un local sin aprobar", "Leer el aviso de arriba"],
    seVe: ["Que dice que depende de nosotros", "La lista de lo que falta por completar"],
    negativo: null,
  },
  {
    codigo: "Q-04",
    titulo: "Ver las estadísticas del local",
    rol: "local",
    entrada: "/local",
    pasos: ["Bajar a «Cómo va»", "Cambiar entre 7, 30 y 90 días"],
    seVe: ["Que los números CAMBIAN al cambiar de periodo", "La frase de conversión, también si es 0"],
    negativo: null,
  },

  // ---------- Promotor ----------
  {
    codigo: "E-08",
    titulo: "Publicar un tardeo como promotor",
    rol: "promotor",
    entrada: "/local/crear",
    pasos: ["Crear un tardeo", "Buscar el sitio en el mapa", "Publicar", "Comprobarlo en /mapa"],
    seVe: ["Que se le pide el sitio en cada tardeo", "La chincheta en el mapa"],
    negativo: "Publicar sin elegir sitio: debe avisar.",
  },

  // ---------- DJ ----------
  {
    codigo: "E-03",
    titulo: "Perfil de DJ con contenidos",
    rol: "dj",
    entrada: "/dj",
    pasos: ["Subir avatar", "Añadir una sesión", "Añadir una foto a la galería", "Ver el perfil público"],
    seVe: ["Los contenidos en el perfil público", "La galería con nombre accesible en cada foto"],
    negativo: "Pegar un enlace que no es una dirección web: no debe convertirse en un enlace.",
  },

  // ---------- Administración ----------
  {
    codigo: "A-06",
    titulo: "Aprobar un local y ver el efecto",
    rol: "admin",
    entrada: "/admin/colaboradores",
    pasos: [
      "Ver la portada ANTES, con las tarjetas sin nombre de local",
      "Aprobar el local",
      "Recargar la portada",
    ],
    seVe: ["El antes y el después de la portada en el mismo vídeo"],
    negativo: null,
  },
  {
    codigo: "A-08",
    titulo: "Ocultar una ficha sin acusarla de impago",
    rol: "admin",
    entrada: "/admin/colaboradores",
    pasos: ["Ocultar un local con el ojo", "Ver su estado en Suscripciones", "Volver a mostrarlo"],
    seVe: ["Que el estado es «Oculta» y no «Oculta por impago»"],
    negativo: "En Suscripciones, poner «oculta por impago» a un local al corriente: debe rechazarlo con un motivo legible.",
  },
  {
    codigo: "A-02",
    titulo: "Una suscripción que caduca",
    rol: "admin",
    entrada: "/admin/suscripciones",
    pasos: ["Poner a un local fecha de fin pasada", "Mirar el recurrente y el recuento"],
    seVe: ["Que sale como caducada y NO cuenta como al corriente", "Que el recurrente baja"],
    negativo: null,
  },
  {
    codigo: "Q-01",
    titulo: "Resolver una denuncia de flyer",
    rol: "admin",
    entrada: "/admin/moderacion",
    pasos: ["Abrir la pestaña de Flyers", "Ver la denuncia con su prueba", "Resolverla"],
    seVe: ["La imagen DENUNCIADA, aunque el local la haya cambiado después"],
    negativo: "Intentar resolverla con una cuenta que no es admin: no debe guardarse.",
  },
  {
    codigo: "Q-05",
    titulo: "Rechazar una reseña y atender la apelación",
    rol: "admin",
    entrada: "/admin/moderacion",
    pasos: ["Rechazar una reseña eligiendo motivo", "Esperar la apelación", "Verla en la cola con su historia"],
    seVe: ["El motivo elegido", "La apelación junto a la decisión anterior"],
    negativo: null,
  },
  {
    codigo: "Q-06",
    titulo: "Comprobar la salud del sistema",
    rol: "admin",
    entrada: "/admin/salud",
    pasos: ["Abrir la pantalla", "Leer los avisos"],
    seVe: ["Cada pieza con su estado", "Qué fichero pegar cuando falta algo"],
    negativo: null,
  },
  {
    codigo: "A-10",
    titulo: "Ordenar los destacados de la portada",
    rol: "admin",
    entrada: "/admin/destacados",
    pasos: ["Filtrar por zona", "Subir y bajar un destacado", "Ver la portada"],
    seVe: ["Cada zona UNA sola vez en el filtro", "El orden reflejado en la portada"],
    negativo: "Con una cuenta de local, intentar destacarse editando su tardeo: la base lo revierte.",
  },
];

/** Los flujos de un rol, para grabar de una sentada sin cambiar de cuenta. */
export const flujosDe = (rol: Rol): Flujo[] => FLUJOS.filter((f) => f.rol === rol);

/**
 * El orden de grabación: por rol, no por código.
 *
 * Cambiar de cuenta es lo más lento de grabar. Agrupando por rol se entra una
 * vez con cada uno y se graba todo lo suyo seguido.
 */
export const ORDEN_DE_GRABACION: Rol[] = ["visitante", "tardicola", "local", "promotor", "dj", "admin"];

/**
 * Cómo se llama el fichero. Por rol, código y versión, que es lo que pide la
 * auditoría: sin la versión dentro del nombre, a los tres meses nadie sabe si
 * un vídeo enseña lo que hay hoy o lo que había cuando se grabó.
 */
export const nombreDeFichero = (f: Flujo, version: string): string =>
  `${f.rol}__${f.codigo}__${f.titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}__v${version}.mp4`;
