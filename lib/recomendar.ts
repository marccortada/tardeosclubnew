import type { Tardeo } from "./types";
import type { AdnTardicola } from "./tardicola";
import { normalizarEstilo, familiasDe, etiquetaDe, vecindariosDe } from "./musica";
import { contiene, mismoValor } from "./adn";

/**
 * Cuánto encaja un tardeo con lo que le gusta a alguien.
 *
 * LA REGLA QUE LO SOSTIENE TODO: lo que no se sabe NO resta.
 *
 * Solo se comparan los criterios en los que las dos partes han dicho algo. De
 * los 662 tardeos de la cartelera, casi ninguno trae ambiente ni público —la
 * app antigua no tiene esos campos—, así que si la ausencia penalizara, el
 * "para ti" saldría vacío y las recomendaciones serían peores que no tener
 * ninguna. Un tardeo sin datos no es un mal plan: es un plan del que no
 * sabemos nada, y se queda en el orden de siempre.
 *
 * Por eso la puntuación se da EN BRUTO y no en porcentaje. Con porcentaje, un
 * tardeo que solo coincide en el dress code (1 de 1 comparable) sacaría un
 * 100% y adelantaría a otro que acierta música, tipo y edad pero falla el
 * outfit. Sumando puntos, quien más cosas acierta va delante, que es lo que
 * espera cualquiera.
 */

/** Lo que vale cada acierto. La música manda: es lo que de verdad decide si
 *  alguien entra a un sitio o pasa de largo. */
const PESOS = {
  estiloExacto: 5,
  familiaMusical: 3,
  tipoEvento: 3,
  ambiente: 2,
  edad: 2,
  dressCode: 1,
};

/**
 * Lo mismo, pero cuando el dato lo pone el LOCAL y no el tardeo.
 *
 * Vale la mitad, y no es una cifra al azar: que un sitio sea "de ambiente
 * chill" habitualmente no garantiza que ESA tarde lo sea, y que pinche house de
 * normal no impide que esa noche traiga a un invitado de otra cosa. Es una
 * pista buena, pero es una pista sobre el sitio, no sobre el plan.
 *
 * Sin esto las recomendaciones no existirían: de los 780 tardeos de la
 * cartelera casi ninguno trae ambiente, público ni outfit —la app antigua no
 * tiene esos campos—, mientras que un local puede describirse UNA vez y servir
 * para todos sus tardeos. Es justo la cadena que pedía el documento:
 *   ADN Tardícola <-> ADN Local <-> ADN Evento
 */
const PESOS_LOCAL = {
  estiloExacto: 3,
  familiaMusical: 2,
  ambiente: 1,
  edad: 1,
  dressCode: 1,
};

export type Encaje = {
  /** Puntos. 0 = no hay nada que comparar o no coincide nada. */
  puntos: number;
  /** En cuántos criterios había datos por las dos partes. */
  comparados: number;
  /** Por qué encaja, en palabras. Para poder enseñárselo al usuario: una
   *  recomendación que no se explica parece arbitraria. */
  motivos: string[];
  /**
   * Lo acertado sobre lo comparable, en porcentaje. `null` cuando hay tan poco
   * que comparar que el número engañaría.
   *
   * NO se usa para ordenar —para eso están los puntos, ver arriba— sino solo
   * para enseñarlo. Son dos preguntas distintas: "cuál te pongo primero" la
   * contestan los puntos, "cuánto encaja este" la contesta esto.
   */
  compatibilidad: number | null;
};

export function encajeDe(t: Tardeo, adn: AdnTardicola | null): Encaje {
  const vacio: Encaje = { puntos: 0, comparados: 0, motivos: [], compatibilidad: null };
  if (!adn) return vacio;

  let puntos = 0;
  let comparados = 0;
  /**
   * El denominador del porcentaje: lo máximo que se podía sacar en los
   * criterios que SÍ se han comparado.
   *
   * Se mide SIEMPRE con los pesos del evento, aunque el acierto haya venido del
   * local. Es deliberado: un tardeo mudo cuyo local encaja del todo sacaba un
   * 100 %, y eso engaña —sabemos que el SITIO encaja, no que esa tarde lo haga—.
   * Midiendo contra el máximo del evento, ese caso da 46 %: encaja, pero sobre
   * menos evidencia, y el número lo dice.
   */
  let maximo = 0;
  const motivos: string[] = [];

  // --- Música ---
  // El estilo del tardeo viene escrito a mano ("Techouse", "Latino + Salsa"),
  // así que se traduce al vocabulario común antes de comparar. Sin esto, a
  // quien le guste Tech House no le saldría un tardeo que puso "Techouse".
  // La música del tardeo si la trae; si no, la habitual del sitio.
  const musicaLocal = t.local?.adn?.musica ?? [];
  const deLocal = !t.estilo && musicaLocal.length > 0;
  const hayMusica = Boolean(t.estilo) || musicaLocal.length > 0;
  if (adn.musica.length && hayMusica) {
    comparados++;
    maximo += PESOS.estiloExacto;

    /**
     * La del local se normaliza etiqueta a etiqueta, NO uniéndolas en un texto.
     *
     * Unirlas con " · " parecía lo natural y no funcionaba: normalizarEstilo()
     * trocea por "+ / , ; &" y por la palabra "y", pero no por el punto medio,
     * así que "House · Remember · Techno" entraba como una sola etiqueta que no
     * existe y no reconocía ninguna. Callado, y peor en los locales con más
     * datos: los de una sola sí funcionaban. Aquí no hace falta trocear nada
     * porque ya vienen separadas; convertirlas a texto para volver a partirlo
     * era el error.
     */
    const estilosT = t.estilo
      ? normalizarEstilo(t.estilo)
      : [...new Set(musicaLocal.flatMap((m) => normalizarEstilo(m)))];
    const familiasT = t.estilo
      ? familiasDe(t.estilo)
      : [...new Set(musicaLocal.flatMap((m) => familiasDe(m)))];

    // El texto depende de QUÉ se ha acertado, no de por qué rama entró: un id
    // sin ":" es una familia entera ("remember"), con ":" es un estilo
    // concreto ("electronica:tech house"). Sin esta distinción, el mismo tipo
    // de acierto se explicaba de dos maneras distintas según el caso.
    const frase = (id: string) =>
      id.includes(":") ? `Te gusta el ${etiquetaDe(id)}` : `Va de ${etiquetaDe(id).toLowerCase()}`;

    const exacto = adn.musica.find((m) => estilosT.includes(m));
    if (exacto) {
      puntos += deLocal ? PESOS_LOCAL.estiloExacto : PESOS.estiloExacto;
      motivos.push(deLocal ? `Aquí suele sonar ${etiquetaDe(exacto)}` : frase(exacto));
    } else {
      // Si no acierta el estilo exacto, vale el parecido: a quien le gusta el
      // Afro House probablemente no le disguste un Deep House.
      //
      // Se comparan VECINDARIOS por los dos lados, y no las familias del
      // tardeo contra los gustos. Esa era la comparación de antes y no podía
      // acertar nunca: el gusto se guarda como "electronica:deep house" y la
      // familia del tardeo es "electronica", así que buscar la primera dentro
      // de la segunda daba siempre no. La regla del parecido existía en el
      // código pero no llegaba a aplicarse a nadie que hubiera elegido estilos
      // concretos, que es lo que elige todo el mundo en el alta.
      // Sobre `estilosT` y no sobre las familias del tardeo. Parece lo mismo y
      // no lo es: la familia de un tardeo de Trance es "electronica", y
      // "electronica" abre TODOS sus grupos, con lo que el Trance acababa
      // pareciéndose al Deep House. `estilosT` ya trae la familia suelta
      // cuando el tardeo no concreta ("Electrónica" a secas), que es el único
      // caso en el que abrirla entera es correcto.
      const vecinosT = new Set((estilosT.length ? estilosT : familiasT).flatMap(vecindariosDe));
      const porFamilia = adn.musica.find((m) => vecindariosDe(m).some((v) => vecinosT.has(v)));
      if (porFamilia) {
        puntos += deLocal ? PESOS_LOCAL.familiaMusical : PESOS.familiaMusical;
        // Se dice que se PARECE, no que sea lo suyo: si el motivo de un Afro
        // House dijera "Te gusta el Deep House", la primera reacción de
        // cualquiera sería que la app no sabe distinguirlos.
        // "Suena a X" y no "Del palo del X": el artículo obliga a saber el
        // género de cada etiqueta y salía "del palo del Salsa". Así vale para
        // todas, y además dice lo que es —un parecido— sin prometer el acierto.
        motivos.push(deLocal
          ? `Aquí suena a ${etiquetaDe(porFamilia)}`
          : `Suena a ${etiquetaDe(porFamilia)}`);
      }
    }
  }

  // --- Tipo de plan ---
  if (adn.tiposEvento.length && t.tipoEvento) {
    comparados++;
    maximo += PESOS.tipoEvento;
    if (contiene(adn.tiposEvento, t.tipoEvento)) {
      puntos += PESOS.tipoEvento;
      motivos.push(`Es un ${t.tipoEvento.toLowerCase()}`);
    }
  }

  // --- Ambiente ---
  // No se pregunta en el alta, pero la columna existe y puede llenarse sola
  // más adelante. Si está, cuenta.
  const ambienteT = t.ambiente?.length ? t.ambiente : (t.local?.adn?.ambiente ?? []);
  const ambienteDelLocal = !t.ambiente?.length && ambienteT.length > 0;
  if (adn.ambiente.length && ambienteT.length) {
    comparados++;
    maximo += PESOS.ambiente;
    const coincide = adn.ambiente.find((a) => contiene(ambienteT, a));
    if (coincide) {
      puntos += ambienteDelLocal ? PESOS_LOCAL.ambiente : PESOS.ambiente;
      motivos.push(ambienteDelLocal
        ? `Sitio ${coincide.toLowerCase()}`
        : `Ambiente ${coincide.toLowerCase()}`);
    }
  }

  // --- Edad ---
  // Solo cuenta cuando el tardeo dice a quién apunta. Que no lo diga no
  // significa que no sea para ti.
  const publicoT = t.publico?.length ? t.publico : (t.local?.adn?.publico ?? []);
  const publicoDelLocal = !t.publico?.length && publicoT.length > 0;
  if (adn.publico && publicoT.length) {
    comparados++;
    maximo += PESOS.edad;
    if (contiene(publicoT, adn.publico)) {
      puntos += publicoDelLocal ? PESOS_LOCAL.edad : PESOS.edad;
      motivos.push(`Para tu edad (${adn.publico})`);
    }
  }

  // --- Outfit ---
  const outfitT = t.dressCode || t.local?.adn?.dressCode;
  if (adn.dressCodes.length && outfitT) {
    comparados++;
    maximo += PESOS.dressCode;
    if (adn.dressCodes.some((d) => mismoValor(d, outfitT))) {
      puntos += PESOS.dressCode;
      motivos.push(outfitT);
    }
  }

  /**
   * El porcentaje solo si hay al menos TRES criterios comparados.
   *
   * Con uno o dos, el número miente: coincidir en el outfit y nada más daría un
   * 100% que nadie se creería al leer "100% compatible" bajo un tardeo del que
   * no sabemos casi nada. Por debajo de tres se enseñan los motivos y ya, que
   * son verdad sin fingir precisión.
   */
  const compatibilidad = comparados >= 3 && maximo > 0
    ? Math.round((puntos / maximo) * 100)
    : null;

  return { puntos, comparados, motivos, compatibilidad };
}

/**
 * Ordena por encaje, y a igualdad por fecha.
 *
 * El desempate por fecha no es un detalle: sin él, los cientos de tardeos con
 * 0 puntos saldrían en el orden en que vinieron de la base, que no significa
 * nada. Con él, quien no tenga gustos rellenados ve exactamente el listado de
 * siempre — el de "lo próximo primero" — y no un revoltijo.
 */
export function ordenarPorEncaje(tardeos: Tardeo[], adn: AdnTardicola | null): Tardeo[] {
  if (!adn) return tardeos;
  const puntosDe = new Map(tardeos.map((t) => [t.id, encajeDe(t, adn).puntos]));
  return [...tardeos].sort((a, b) => {
    const d = (puntosDe.get(b.id) ?? 0) - (puntosDe.get(a.id) ?? 0);
    return d !== 0 ? d : a.fecha.localeCompare(b.fecha);
  });
}

/**
 * Los que de verdad encajan, para el carrusel de portada.
 *
 * Exige al menos un acierto: un carrusel titulado "Para ti" lleno de tardeos
 * que no tienen nada que ver con lo que dijiste hace más daño que no tenerlo.
 * Si no llega a `minimo`, se devuelve vacío y quien llama no pinta la sección.
 */
export type Recomendacion = { tardeo: Tardeo; encaje: Encaje };

export function paraTi(
  tardeos: Tardeo[],
  adn: AdnTardicola | null,
  limite = 10,
  minimo = 3,
): Recomendacion[] {
  if (!adn) return [];
  const conPuntos = tardeos
    .map((tardeo) => ({ tardeo, encaje: encajeDe(tardeo, adn) }))
    .filter((x) => x.encaje.puntos > 0)
    .sort((a, b) => (b.encaje.puntos - a.encaje.puntos) || a.tardeo.fecha.localeCompare(b.tardeo.fecha));
  // Se devuelve el encaje junto al tardeo, y no solo el tardeo, para poder
  // ENSEÑAR por qué está ahí. Una recomendación sin explicación se lee como
  // publicidad; con ella se lee como que alguien te ha entendido.
  return conPuntos.length >= minimo ? conPuntos.slice(0, limite) : [];
}
