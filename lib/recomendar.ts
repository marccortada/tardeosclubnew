import type { Tardeo } from "./types";
import type { AdnTardicola } from "./tardicola";
import { normalizarEstilo, familiasDe, etiquetaDe } from "./musica";
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

export type Encaje = {
  /** Puntos. 0 = no hay nada que comparar o no coincide nada. */
  puntos: number;
  /** En cuántos criterios había datos por las dos partes. */
  comparados: number;
  /** Por qué encaja, en palabras. Para poder enseñárselo al usuario: una
   *  recomendación que no se explica parece arbitraria. */
  motivos: string[];
};

export function encajeDe(t: Tardeo, adn: AdnTardicola | null): Encaje {
  const vacio: Encaje = { puntos: 0, comparados: 0, motivos: [] };
  if (!adn) return vacio;

  let puntos = 0;
  let comparados = 0;
  const motivos: string[] = [];

  // --- Música ---
  // El estilo del tardeo viene escrito a mano ("Techouse", "Latino + Salsa"),
  // así que se traduce al vocabulario común antes de comparar. Sin esto, a
  // quien le guste Tech House no le saldría un tardeo que puso "Techouse".
  if (adn.musica.length && t.estilo) {
    comparados++;
    const estilosT = normalizarEstilo(t.estilo);
    const familiasT = familiasDe(t.estilo);

    // El texto depende de QUÉ se ha acertado, no de por qué rama entró: un id
    // sin ":" es una familia entera ("remember"), con ":" es un estilo
    // concreto ("electronica:tech house"). Sin esta distinción, el mismo tipo
    // de acierto se explicaba de dos maneras distintas según el caso.
    const frase = (id: string) =>
      id.includes(":") ? `Te gusta el ${etiquetaDe(id)}` : `Va de ${etiquetaDe(id).toLowerCase()}`;

    const exacto = adn.musica.find((m) => estilosT.includes(m));
    if (exacto) {
      puntos += PESOS.estiloExacto;
      motivos.push(frase(exacto));
    } else {
      // Si no acierta el estilo, vale la familia: a quien le gusta el Afro
      // House probablemente no le disguste un Deep House.
      const porFamilia = adn.musica.find((m) => familiasT.includes(m));
      if (porFamilia) {
        puntos += PESOS.familiaMusical;
        motivos.push(frase(porFamilia));
      }
    }
  }

  // --- Tipo de plan ---
  if (adn.tiposEvento.length && t.tipoEvento) {
    comparados++;
    if (contiene(adn.tiposEvento, t.tipoEvento)) {
      puntos += PESOS.tipoEvento;
      motivos.push(`Es un ${t.tipoEvento.toLowerCase()}`);
    }
  }

  // --- Ambiente ---
  // No se pregunta en el alta, pero la columna existe y puede llenarse sola
  // más adelante. Si está, cuenta.
  if (adn.ambiente.length && t.ambiente?.length) {
    comparados++;
    const coincide = adn.ambiente.find((a) => contiene(t.ambiente, a));
    if (coincide) {
      puntos += PESOS.ambiente;
      motivos.push(`Ambiente ${coincide.toLowerCase()}`);
    }
  }

  // --- Edad ---
  // Solo cuenta cuando el tardeo dice a quién apunta. Que no lo diga no
  // significa que no sea para ti.
  if (adn.publico && t.publico?.length) {
    comparados++;
    if (contiene(t.publico, adn.publico)) {
      puntos += PESOS.edad;
      motivos.push(`Para tu edad (${adn.publico})`);
    }
  }

  // --- Outfit ---
  if (adn.dressCodes.length && t.dressCode) {
    comparados++;
    if (adn.dressCodes.some((d) => mismoValor(d, t.dressCode))) {
      puntos += PESOS.dressCode;
      motivos.push(t.dressCode);
    }
  }

  return { puntos, comparados, motivos };
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
export function paraTi(tardeos: Tardeo[], adn: AdnTardicola | null, limite = 10, minimo = 3): Tardeo[] {
  if (!adn) return [];
  const conPuntos = tardeos
    .map((t) => ({ t, e: encajeDe(t, adn) }))
    .filter((x) => x.e.puntos > 0)
    .sort((a, b) => (b.e.puntos - a.e.puntos) || a.t.fecha.localeCompare(b.t.fecha));
  return conPuntos.length >= minimo ? conPuntos.slice(0, limite).map((x) => x.t) : [];
}
