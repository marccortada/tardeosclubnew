/**
 * Qué abre cada plan.
 *
 * UN SOLO SITIO con la tabla de capacidades, y a propósito. Repartida por las
 * pantallas —"aquí miro si es pro, allí si es premium"— se desincroniza el día
 * que se mueve una prestación de nivel, y entonces un local paga por algo que
 * no le sale o le sale algo que no paga. Las dos cosas son igual de malas.
 *
 * Se corresponde con la oferta comercial acordada:
 *   basic 10 € al mes · pro 20 € al mes · premium 30 € al mes
 *   fundador 40 € al mes los dos primeros meses, luego 30 € al mes
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

/**
 * Lo que se cobra, CON SU PERIODO.
 *
 * El periodo va dentro del precio y no es una floritura. Antes esto era un
 * número suelto por plan y el Fundador figuraba como "30" sin decir de qué
 * periodo, ni que los dos primeros meses no se paga eso. En pantalla salía
 * «Fundador · 30 €», que es verdad a partir del tercer mes y mentira antes.
 *
 * Con el importe, los meses y el alta juntos, cualquier sitio que enseñe un
 * precio está obligado a decir cada cuánto se cobra: no se puede pintar
 * `PRECIO[p]` a secas porque ya no es un número. Eso es a propósito.
 */
export const PRECIO: Record<Plan, {
  euros: number;
  meses: number;
  /** Condición de entrada, cuando el plan tiene una distinta de la de siempre. */
  alta?: { euros: number; meses: number };
}> = {
  basic:    { euros: 10, meses: 1 },
  pro:      { euros: 20, meses: 1 },
  premium:  { euros: 30, meses: 1 },
  // El Fundador entra pagando más y se queda en Premium: 40 € al mes los dos
  // primeros meses, 30 € al mes a partir del tercero.
  fundador: { euros: 30, meses: 1, alta: { euros: 40, meses: 2 } },
};

/** "al mes" / "cada 2 meses". Lo que hay que enseñar pegado al importe. */
export const periodoDe = (plan: Plan): string =>
  PRECIO[plan].meses === 1 ? "al mes" : `cada ${PRECIO[plan].meses} meses`;

/**
 * El precio entero, para pintarlo de una pieza.
 *
 * "30 € al mes" para los normales; "40 € al mes los 2 primeros meses, luego
 * 30 € al mes" para el Fundador. Largo a propósito: el importe corto es justo
 * el que no se entiende, y esto se enseña donde alguien decide pagar.
 */
export const precioTexto = (plan: Plan): string => {
  const p = PRECIO[plan];
  const base = `${p.euros} € ${periodoDe(plan)}`;
  if (!p.alta) return base;
  return `${p.alta.euros} € al mes los ${p.alta.meses} primeros meses, luego ${base}`;
};

/** Sin la condición de entrada. Para sitios estrechos, como un desplegable. */
export const precioCorto = (plan: Plan): string =>
  `${PRECIO[plan].euros} € ${periodoDe(plan)}${PRECIO[plan].alta ? " (alta aparte)" : ""}`;

/**
 * El importe llevado a un mes, para poder SUMAR planes con periodos distintos.
 *
 * Se usa el precio DE SIEMPRE, no el de alta: el recurrente es lo que entra
 * mes tras mes cuando la promoción de entrada ya ha pasado. Contar los 40 € de
 * los dos primeros meses como si fueran para siempre daría una previsión que
 * baja sola dentro de dos meses sin que nadie se dé de baja.
 */
export const euroMes = (plan: Plan): number => PRECIO[plan].euros / PRECIO[plan].meses;

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
 * Lo mismo, pero respetando el interruptor general.
 *
 * Es la que hay que usar en la app. Mientras las reglas están apagadas devuelve
 * `true` para todo: la web se comporta exactamente como antes de que existieran
 * los planes. Así las reglas se pueden escribir, revisar y probar mucho antes
 * de que le quiten nada a nadie.
 */
export function puedeSiActivo(
  plan: string | null | undefined,
  capacidad: Capacidad,
  reglasActivas: boolean
): boolean {
  return !reglasActivas || puede(plan, capacidad);
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
