/**
 * Caché en memoria de un proceso, con la petición compartida.
 *
 * Las páginas públicas dejaron de usar la regeneración de Next (ISR) porque se
 * atascaba: dos veces en seis días la web se quedó enseñando la cartelera de
 * hacía cinco días, respondiendo `x-nextjs-cache: STALE` a cada petición sin
 * rehacerse nunca. Ni el temporizador ni `revalidatePath` la desatascaban; solo
 * reiniciar el proceso.
 *
 * Ahora esas páginas se pintan en cada visita y la frescura la garantiza esto,
 * que es código nuestro y se puede razonar: como mucho una consulta por minuto
 * y por dato, la vengan a pedir mil visitas o una.
 *
 * `enVuelo` comparte la petición en curso para que dos componentes que piden lo
 * mismo a la vez no hagan dos viajes, y `generacion` evita guardar un resultado
 * que salió ANTES de una invalidación: si alguien publica un tardeo mientras la
 * consulta viaja, lo que llega ya es viejo y no debe quedarse en la caché.
 */
export function memo<T>(cargar: () => Promise<T>, ms = 60_000) {
  let cache: { cuando: number; datos: T } | null = null;
  let enVuelo: Promise<T> | null = null;
  let generacion = 0;

  return {
    async get(): Promise<T> {
      if (cache && Date.now() - cache.cuando < ms) return cache.datos;
      if (enVuelo) return enVuelo;
      const gen = generacion;
      enVuelo = (async () => {
        try {
          const datos = await cargar();
          if (gen === generacion) cache = { cuando: Date.now(), datos };
          return datos;
        } finally {
          enVuelo = null;
        }
      })();
      return enVuelo;
    },
    invalidar() {
      cache = null;
      generacion++;
    },
  };
}
