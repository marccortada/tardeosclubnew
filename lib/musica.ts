/**
 * El vocabulario musical de TardeosClub.
 *
 * Es una sola lista para todo: tardeos, DJs, locales, promotores y —cuando
 * llegue— el ADN del tardícola. Si cada sitio tuviera la suya no se podrían
 * cruzar, que es justo lo que hace falta para recomendar.
 *
 * OJO con una cosa de la taxonomía: hay etiquetas que salen en DOS familias.
 * "House" está en REMEMBER y en ELECTRÓNICA; "Dance" en REMEMBER y en
 * ELECTRÓNICA; "Comercial" en REMEMBER y como familia propia. No son lo mismo:
 * un remember-house no es un deep house. Por eso el identificador lleva la
 * familia dentro (`remember:house` ≠ `electronica:house`) y la etiqueta que se
 * enseña es la corta, porque dentro de su familia no hay ambigüedad.
 */

export type Grupo = {
  /** Subfamilia dentro de ELECTRÓNICA. El resto de familias no la usan. */
  nombre?: string;
  estilos: string[];
};

export type Familia = {
  id: string;
  nombre: string;
  grupos: Grupo[];
};

export const FAMILIAS: Familia[] = [
  {
    id: "remember",
    nombre: "Remember",
    grupos: [
      { estilos: ["70's", "80's", "90's", "2000's", "2010's", "Dance", "Comercial", "House", "Makina"] },
    ],
  },
  {
    id: "electronica",
    nombre: "Electrónica",
    grupos: [
      {
        nombre: "House",
        estilos: [
          "House", "Deep House", "Tech House", "Afro House", "Latin House",
          "Melodic House", "Funky House", "Soulful House", "Vocal House",
          "Disco House", "Groove",
        ],
      },
      {
        nombre: "Techno / Dance",
        estilos: [
          "Techno", "Dance", "EDM", "Electro", "Melodic Techno", "Progressive",
          "Trance", "Mainstream", "Hardcore", "Techno Flamenco",
        ],
      },
      {
        nombre: "Chill / Sunset",
        estilos: ["Chill Out", "Lounge", "Sunset", "Balearic", "Downtempo"],
      },
      { nombre: "Underground", estilos: ["Underground"] },
    ],
  },
  {
    id: "comercial",
    nombre: "Comercial",
    grupos: [
      { estilos: ["Hits", "Éxitos", "Top Hits", "Pop Comercial", "Dance Comercial", "Urban Comercial", "Pachangueo"] },
    ],
  },
  {
    id: "urban",
    nombre: "Urban",
    grupos: [
      { estilos: ["Urban", "Reggaeton", "Trap", "Hip Hop", "Rap", "R&B", "Afrobeats", "Dancehall", "Dembow", "Urban Latino"] },
    ],
  },
  {
    id: "latina",
    nombre: "Latina",
    grupos: [
      {
        estilos: [
          "Latino", "Salsa", "Bachata", "Merengue", "Cumbia", "Reggaeton Latino",
          "Latin Pop", "Latina Comercial", "Kizomba", "Punta", "Samba", "Raspe", "SBK",
        ],
      },
    ],
  },
  {
    id: "variada",
    nombre: "Variada",
    grupos: [
      {
        estilos: [
          "Flamenco", "Flamenco Pop", "Sevillanas", "Rumba", "Rumba Catalana",
          "Música Española", "Pop", "Rock", "Indie", "Heavy", "Jazz", "Blues",
          "Bossa Nova", "Swing", "Fusión", "Música en directo", "Funk", "Soul",
          "Motown", "Nu-Disco",
        ],
      },
    ],
  },
];

/** Todas las hojas, con su familia. */
export type Estilo = { id: string; etiqueta: string; familia: string; grupo?: string };

export const ESTILOS_TODOS: Estilo[] = FAMILIAS.flatMap((f) =>
  f.grupos.flatMap((g) =>
    g.estilos.map((e) => ({ id: `${f.id}:${clave(e)}`, etiqueta: e, familia: f.id, grupo: g.nombre }))
  )
);

export function familiaDe(id: string): Familia | undefined {
  return FAMILIAS.find((f) => f.id === id.split(":")[0]);
}

/**
 * El id de un estilo dentro de su familia. Única forma de construirlo: si la
 * interfaz se lo montara por su cuenta, cualquier cambio en cómo se normaliza
 * dejaría de casar con los ids y los filtros no encontrarían nada.
 */
export function idEstilo(familiaId: string, etiqueta: string): string {
  return `${familiaId}:${clave(etiqueta)}`;
}

export function etiquetaDe(id: string): string {
  const hoja = ESTILOS_TODOS.find((e) => e.id === id);
  if (hoja) return hoja.etiqueta;
  // Un id sin ":" es una familia entera ("electronica"), no un estilo: pasa
  // cuando el local puso solo "Electrónica" sin concretar.
  return FAMILIAS.find((f) => f.id === id)?.nombre ?? id;
}

/** Nombre legible con familia delante, para cuando el contexto no la deja clara. */
export function etiquetaLarga(id: string): string {
  const e = ESTILOS_TODOS.find((x) => x.id === id);
  if (!e) return id;
  const fam = FAMILIAS.find((f) => f.id === e.familia);
  return fam && fam.id !== "variada" ? `${e.etiqueta} · ${fam.nombre}` : e.etiqueta;
}

// ---------- Normalización de lo que ya hay en la base ----------

/** Minúsculas, sin acentos y sin signos: para comparar sin sustos. */
function clave(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // Los diacríticos, por código y no como carácter literal: escritos a pelo
    // son invisibles en el editor y cualquier copiar-pegar los pierde.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Lo que los locales escribieron a mano en la app antigua, traducido.
 *
 * Son 662 tardeos con 58 valores distintos: mayúsculas a su aire, faltas
 * ("Tecno", "Techouse", "Afrohouse", "progesive"), nombres propios ("pagode",
 * "Open Format") y compuestos ("Latino + Salsa + Bachata"). Sin esta tabla, al
 * estrenar la taxonomía los filtros dejarían de encontrar la cartelera entera.
 *
 * La clave va normalizada (sin acentos ni mayúsculas), así que "Electrónica",
 * "electronica" y "ELECTRONICA" caen en la misma entrada.
 */
const ALIAS: Record<string, string> = {
  /**
   * Las tres etiquetas que están en dos familias. Sin desempate explícito
   * ganaría la primera de FAMILIAS (Remember), y los 112 tardeos que pusieron
   * "House" a secas —house electrónico casi todos— acabarían en Remember.
   *
   * A secas significan la familia musical; el remember lleva apellido, que es
   * además como se escriben en la app antigua y en el documento original
   * ("Remember House", "Remember Dance", "Remember Comercial").
   */
  "house": "electronica:house",
  "dance": "electronica:dance",
  "remember house": "remember:house",
  "remember dance": "remember:dance",
  "remember comercial": "remember:comercial",
  "remember makina": "remember:makina",

  // --- Errores de escritura y variantes ---
  "tecno": "electronica:techno",
  "techouse": "electronica:tech house",
  "technohouse": "electronica:tech house",
  "afrohouse": "electronica:afro house",
  "hardtechno": "electronica:hardcore",
  "progesive house": "electronica:progressive",
  "progresive": "electronica:progressive",
  "progressive house": "electronica:progressive",
  "electronic": "electronica:electro",
  "soul full": "electronica:soulful house",
  "heavy metal": "variada:heavy",
  "exitos": "comercial:exitos",
  "clasicos": "remember:comercial",
  "disco": "electronica:disco house",
  "disco house remix": "electronica:disco house",
  "organic house": "electronica:melodic house",
  "minimal": "electronica:techno",
  "acid": "electronica:techno",
  "breackbeat": "electronica:electro",
  "ambient": "electronica:downtempo",
  "chill": "electronica:chill out",
  "afrobeat": "urban:afrobeats",

  // --- Décadas ---
  "80s": "remember:80 s",
  "90s": "remember:90 s",
  "2000": "remember:2000 s",
  "remember 70 80": "remember:70 s",
  "remember 90 2000": "remember:90 s",

  // --- Música en directo, que en la app vieja tenía tres nombres ---
  "actuacion en directo": "variada:musica en directo",
  "live music": "variada:musica en directo",
  "acoustic": "variada:musica en directo",

  // --- Estilos que no están en la taxonomía: al más cercano ---
  "pagode": "latina:samba",
  "alternativa": "variada:indie",
  "open format": "comercial:hits",

  // --- Valores de familia, sin estilo concreto ---
  "electronica": "electronica",
  "remember": "remember",
  "comercial": "comercial",
  "latino": "latina:latino",
  "urban": "urban:urban",
  "urbano": "urban:urban",

  // --- Cajones de sastre: mejor sin clasificar que mal clasificado ---
  "otro": "",
  "musica": "",
};

/**
 * Traduce un texto libre a identificadores de la taxonomía.
 *
 * Devuelve una lista porque en la base hay valores compuestos: un
 * "Latino + Salsa + Bachata" son tres estilos, y quedarse solo con el primero
 * escondería el tardeo a quien filtre por bachata.
 *
 * Cuando algo no se reconoce se devuelve vacío en vez de inventar: un tardeo
 * sin estilo sale en "todos", que es correcto; uno mal etiquetado aparece donde
 * no toca y eso el usuario sí lo nota.
 */
export function normalizarEstilo(texto?: string | null): string[] {
  if (!texto) return [];

  // Si ya viene un id de la taxonomía, se devuelve tal cual: es lo que guardan
  // los formularios de la app, y trocearlo por el ":" lo destrozaría.
  const tal = String(texto).trim();
  if (ESTILOS_TODOS.some((e) => e.id === tal)) return [tal];

  const trozos = String(texto).split(/[+/,;]|&|\by\b/gi);
  const salida = new Set<string>();

  for (const trozo of trozos) {
    const k = clave(trozo);
    if (!k) continue;

    if (k in ALIAS) {
      if (ALIAS[k]) salida.add(ALIAS[k]);
      continue;
    }

    // Coincidencia exacta con una hoja. Si la etiqueta está en dos familias
    // (House, Dance, Comercial), gana la primera según el orden de FAMILIAS:
    // Remember va delante porque es de lo que más hay en la cartelera.
    const hoja = ESTILOS_TODOS.find((e) => clave(e.etiqueta) === k);
    if (hoja) { salida.add(hoja.id); continue; }

    // Y si no, una familia por su nombre.
    const fam = FAMILIAS.find((f) => clave(f.nombre) === k);
    if (fam) salida.add(fam.id);
  }

  // "Electrónica + Chill Out" traía la familia suelta Y una hoja suya. La
  // familia sobra: el Chill Out ya la implica, y así no se enseñan dos
  // etiquetas para decir lo mismo.
  const familiasConHoja = new Set(
    [...salida].filter((id) => id.includes(":")).map((id) => id.split(":")[0])
  );
  return [...salida].filter((id) => id.includes(":") || !familiasConHoja.has(id));
}

/**
 * El "vecindario" de un estilo: hasta dónde llega el parecido.
 *
 * Sirve para el "esto se parece a lo tuyo" de las recomendaciones, y la
 * granularidad no es un capricho. La familia entera es demasiado ancha: en
 * ELECTRÓNICA conviven el Chill Out y el Hardcore, y a quien pide sunset no se
 * le puede colar un hardcore diciendo que es lo mismo. El grupo sí vale: Deep
 * House y Afro House son ambos House, y ahí el parecido es real.
 *
 * Las familias sin grupos con nombre (latina, urban, variada...) son ya lo
 * bastante estrechas, y el vecindario es la familia entera.
 *
 * A una familia suelta ("electronica", sin estilo) se le devuelven TODOS sus
 * vecindarios: quien dijo que le gusta la electrónica sin más aceptó el lote.
 */
export function vecindariosDe(id: string): string[] {
  if (id.includes(":")) {
    const e = ESTILOS_TODOS.find((x) => x.id === id);
    if (!e) return [id.split(":")[0]];
    return [e.grupo ? `${e.familia}/${e.grupo}` : e.familia];
  }
  const f = FAMILIAS.find((x) => x.id === id);
  if (!f) return [id];
  return [id, ...f.grupos.map((g) => (g.nombre ? `${id}/${g.nombre}` : id))];
}

/** Las familias a las que pertenece un texto libre. Para el filtro de primer nivel. */
export function familiasDe(texto?: string | null): string[] {
  return [...new Set(normalizarEstilo(texto).map((id) => id.split(":")[0]))];
}

/**
 * El texto que se guarda en la base cuando alguien elige un estilo en un
 * formulario.
 *
 * Se guarda legible y no el id interno, porque este valor se enseña tal cual en
 * la ficha del DJ, en las tarjetas y en los datos estructurados de Google. Las
 * tres etiquetas que están en dos familias van con apellido ("Remember House")
 * para que al volver a leerlas no se confundan con las de Electrónica.
 */
export function valorGuardado(familiaId: string, etiqueta: string): string {
  const choca = ESTILOS_TODOS.filter((e) => clave(e.etiqueta) === clave(etiqueta)).length > 1;
  return choca && familiaId === "remember" ? `Remember ${etiqueta}` : etiqueta;
}

/** Lista plana de etiquetas, para los formularios de alta. */
export const ETIQUETAS_TODAS: string[] = [...new Set(ESTILOS_TODOS.map((e) => e.etiqueta))];
