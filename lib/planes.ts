/**
 * Qué abre cada plan.
 *
 * UN SOLO SITIO con la tabla de capacidades, y a propósito. Repartida por las
 * pantallas —"aquí miro si es pro, allí si es premium"— se desincroniza el día
 * que se mueve una prestación de nivel, y entonces un local paga por algo que
 * no le sale o le sale algo que no paga. Las dos cosas son igual de malas.
 *
 * Se corresponde con la oferta comercial de Marc (26 ago 2026):
 *   basic 10 € · pro 20 € · premium 30 € · fundador 40 € dos meses, luego 30 €
 *
 * OJO con lo que NO está aquí: aftermovies, visitas al local, colaboraciones en
 * Instagram, emisiones con Nexo Radio. Eso son promesas humanas sujetas a
 * planificación, no cosas que el código pueda conceder o denegar. Meterlas aquí
 * daría a entender que la app las garantiza, y la app no puede garantizar que
 * alguien coja una cámara. Es la misma frontera que señaló Marc entre
 * "incluido" y "posibilidad de realizar".
 */

export const PLANES = ["basic", "pro", "premium", "fundador"] as const;
export type Plan = (typeof PLANES)[number];

/** Fundador es premium con condiciones de lanzamiento: mismas capacidades. */
const NIVEL: Record<Plan, number> = { basic: 0, pro: 1, premium: 2, fundador: 2 };

export const ETIQUETA: Record<Plan, string> = {
  basic: "Basic",
  pro: "Pro",
  premium: "Premium",
  fundador: "Fundador",
};

/** Lo que se cobra al mes hoy. El Fundador paga 40 los dos primeros meses. */
export const PRECIO: Record<Plan, number> = { basic: 10, pro: 20, premium: 30, fundador: 30 };
export const PRECIO_FUNDADOR_ALTA = 40;
export const MESES_FUNDADOR_ALTA = 2;

/**
 * Las capacidades, con el plan MÍNIMO que las abre.
 *
 * Solo entran cosas que el código puede hacer cumplir por sí mismo.
 */
export const CAPACIDADES = {
  /** Salir en el mapa y publicar flyers: eso lo tiene todo el mundo. */
  estarEnElMapa: "basic",
  flyersIlimitados: "basic",

  /** El logo en la chincheta, en vez de una chincheta genérica. */
  logoEnElMapa: "pro",
  /** El sello «Local Verificado». */
  selloVerificado: "pro",
  /** Crear promociones con código, fechas y límite de usos (lote 32). */
  promociones: "pro",
  estadisticasBasicas: "pro",

  /** Pop-ups dirigidos por ADN del tardícola (lote 23). */
  popupsSegmentados: "premium",
  estadisticasCompletas: "premium",
  /** Poder salir en 🔥 Tardeos Destacados de la portada. */
  tardeosDestacados: "premium",
} as const satisfies Record<string, Plan>;

export type Capacidad = keyof typeof CAPACIDADES;

/**
 * ¿Este plan abre esa capacidad?
 *
 * Un plan desconocido o ausente cuenta como basic: ante la duda, el nivel de
 * entrada. Nunca al revés — un fallo de lectura no debe regalar Premium.
 */
export function puede(plan: string | null | undefined, capacidad: Capacidad): boolean {
  const p = (PLANES as readonly string[]).includes(plan ?? "") ? (plan as Plan) : "basic";
  return NIVEL[p] >= NIVEL[CAPACIDADES[capacidad]];
}

/** El plan mínimo que hace falta, para poder decírselo a quien no lo tiene. */
export function planNecesario(capacidad: Capacidad): Plan {
  return CAPACIDADES[capacidad];
}

/**
 * ¿Está al corriente de pago?
 *
 * Se mira aparte del plan a propósito: un impago no baja de nivel, deja la
 * suscripción en 'impago' con su plan intacto. Así se sabe a qué volver cuando
 * pague, y se puede decidir por separado si un impago corta el servicio o solo
 * enciende un aviso en el panel.
 */
export function alCorriente(estado: string | null | undefined): boolean {
  return estado === "activa";
}
