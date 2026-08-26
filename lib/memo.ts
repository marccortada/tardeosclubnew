/**
 * Caché en memoria del proceso, con la petición compartida.
 *
 * Las páginas públicas dejaron de usar la regeneración de Next (ISR) porque se
 * atascaba: dos veces en seis días la web se quedó enseñando la cartelera de
 * días atrás sin rehacerse nunca. Ahora se pintan en cada visita y la frescura
 * la garantiza esto: como mucho una consulta por minuto y por dato, la vengan a
 * pedir mil visitas o una.
 *
 * OJO CON EL REGISTRO GLOBAL, que no es manía: el empaquetado de Next puede dar
 * a una ruta de API y a una página COPIAS DISTINTAS del mismo módulo. Con el
 * estado en el cierre de la función, `/api/revalidar` vaciaba su copia y la
 * portada seguía con la suya —comprobado: se quitó un destacado, se avisó a la
 * web y la portada tardó los 60 s del caducado en enterarse—. Colgado de
 * globalThis hay una sola caché por nombre para todo el proceso.
 */
type Entrada = { cache: { cuando: number; datos: unknown } | null; enVuelo: Promise<unknown> | null; generacion: number };

const REGISTRO: Map<string, Entrada> = ((globalThis as Record<string, unknown>).__memoTardeos as Map<string, Entrada>)
  ?? ((globalThis as Record<string, unknown>).__memoTardeos = new Map<string, Entrada>());

function entrada(nombre: string): Entrada {
  let e = REGISTRO.get(nombre);
  if (!e) { e = { cache: null, enVuelo: null, generacion: 0 }; REGISTRO.set(nombre, e); }
  return e;
}

export function memo<T>(nombre: string, cargar: () => Promise<T>, ms = 60_000) {
  return {
    async get(): Promise<T> {
      const e = entrada(nombre);
      if (e.cache && Date.now() - e.cache.cuando < ms) return e.cache.datos as T;
      if (e.enVuelo) return e.enVuelo as Promise<T>;
      const gen = e.generacion;
      e.enVuelo = (async () => {
        try {
          const datos = await cargar();
          // Si alguien invalidó mientras esto viajaba, no se guarda: traería
          // datos ya viejos y los dejaría fijados otro minuto.
          if (gen === e.generacion) e.cache = { cuando: Date.now(), datos };
          return datos;
        } finally {
          e.enVuelo = null;
        }
      })();
      return e.enVuelo as Promise<T>;
    },
    invalidar() {
      const e = entrada(nombre);
      e.cache = null;
      e.enVuelo = null;
      e.generacion++;
    },
  };
}
