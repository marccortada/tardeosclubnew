import { supabase } from "./supabase";
import { PLANES, type Plan } from "./planes";

/**
 * Lo que incluye cada plan y lo que cuesta pasarse.
 *
 * OJO CON UNA COSA: pasarse NO BLOQUEA. El modelo de Marc dice "a partir del
 * quinto evento, +1 €", no "no puedes publicar más". Un local que quiere
 * publicar más está usando la plataforma más, que es exactamente lo que
 * queremos; lo que hay que hacer es cobrarlo, no impedirlo.
 *
 * Por eso esto no es una puerta como `lib/planes.ts` —eso son capacidades que
 * se tienen o no se tienen— sino un contador. Son dos cosas distintas y por eso
 * viven en ficheros distintos.
 *
 * NO HACE FALTA TABLA NUEVA: todo se cuenta de lo que ya está. Los eventos del
 * mes salen de `tardeos.created_at`, las promociones activas de `promociones`.
 * Una tabla de consumos que hay que mantener en sincronía con la realidad se
 * desincroniza; contar la realidad no.
 */

export type Cuota = {
  /** Eventos que puede publicar al mes. null = sin límite. */
  eventosMes: number | null;
  /** Promociones activas a la vez. null = sin límite. 0 = no puede. */
  promosSimultaneas: number | null;
  /** Campañas de pop-up ADN al mes. */
  popupsMes: number;
  /** Tardeos destacados al mes. */
  destacadosMes: number;
};

export const CUOTAS: Record<Plan, Cuota> = {
  basic:    { eventosMes: 4,    promosSimultaneas: 0,    popupsMes: 0, destacadosMes: 0 },
  pro:      { eventosMes: null, promosSimultaneas: 2,    popupsMes: 0, destacadosMes: 0 },
  premium:  { eventosMes: null, promosSimultaneas: null, popupsMes: 1, destacadosMes: 1 },
  // Fundador es Premium con uno más de cada durante su periodo.
  fundador: { eventosMes: null, promosSimultaneas: null, popupsMes: 2, destacadosMes: 2 },
};

/** Lo que se cobra por cada unidad de más, en euros. */
export const PRECIO_EXTRA = {
  evento: 1,
  promocion: 3,
  popup: 5,
  destacado: 5,
} as const;

export type Consumo = {
  eventosMes: number;
  promosActivas: number;
  /** Cuántos se ha pasado de lo incluido, por concepto. */
  eventosDeMas: number;
  promosDeMas: number;
  /** Lo que suma de más este mes, en euros. */
  euros: number;
};

/** Primer día del mes en curso, en hora de España. */
export function inicioDeMes(d = new Date()): string {
  const madrid = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  return `${madrid.slice(0, 7)}-01`;
}

const plan = (p: string | null | undefined): Plan =>
  (PLANES as readonly string[]).includes(p ?? "") ? (p as Plan) : "basic";

/**
 * Qué lleva consumido este local este mes.
 *
 * Se cuenta desde el día 1 del mes en curso y no "en los últimos 30 días": la
 * factura va por meses naturales, y una ventana móvil daría un número que no
 * cuadra con lo que se cobra.
 */
export async function consumoDeLocal(localId: string, planLocal: string | null | undefined): Promise<Consumo> {
  const p = plan(planLocal);
  const c = CUOTAS[p];
  const desde = inicioDeMes();

  const [ev, pr] = await Promise.all([
    supabase.from("tardeos").select("id", { count: "exact", head: true })
      .eq("local_id", localId).gte("created_at", `${desde}T00:00:00Z`),
    supabase.from("promociones").select("id,activa,desde,hasta,limite_usos,usos")
      .eq("activa", true),
  ]);

  const eventosMes = ev.count ?? 0;
  // Solo las de este local y que estén corriendo de verdad. La política de
  // lectura ya deja fuera las caducadas del resto de gente.
  const ahora = new Date();
  const promosActivas = (pr.data ?? []).filter((x: any) =>
    (!x.desde || new Date(x.desde) <= ahora) &&
    (!x.hasta || new Date(x.hasta) >= ahora) &&
    (x.limite_usos == null || (x.usos ?? 0) < x.limite_usos)
  ).length;

  const eventosDeMas = c.eventosMes == null ? 0 : Math.max(0, eventosMes - c.eventosMes);
  const promosDeMas = c.promosSimultaneas == null ? 0 : Math.max(0, promosActivas - c.promosSimultaneas);

  return {
    eventosMes,
    promosActivas,
    eventosDeMas,
    promosDeMas,
    euros: eventosDeMas * PRECIO_EXTRA.evento + promosDeMas * PRECIO_EXTRA.promocion,
  };
}


/**
 * Lo mismo pero para TODOS los locales de golpe, para el panel del admin.
 *
 * Dos consultas en total y el agrupado en memoria, no una consulta por local:
 * con 68 locales eso serían 136 viajes a la base cada vez que se abre la
 * pantalla, en un servidor que ya va justo.
 */
export async function consumoDeTodos(
  planes: Record<string, string | null | undefined>
): Promise<Record<string, Consumo>> {
  const desde = inicioDeMes();
  const [ev, pr] = await Promise.all([
    supabase.from("tardeos").select("local_id").gte("created_at", `${desde}T00:00:00Z`),
    supabase.from("promociones").select("local_id,tardeo_id,activa,desde,hasta,limite_usos,usos").eq("activa", true),
  ]);

  const eventos: Record<string, number> = {};
  for (const t of ev.data ?? []) {
    if (t.local_id) eventos[t.local_id] = (eventos[t.local_id] ?? 0) + 1;
  }

  // Una promoción puede colgar de un local o de un tardeo; para contarla hay
  // que saber de qué local es el tardeo, así que se piden esos tardeos aparte.
  const idsTardeo = [...new Set((pr.data ?? []).map((x: any) => x.tardeo_id).filter(Boolean))];
  const localDeTardeo: Record<string, string> = {};
  if (idsTardeo.length) {
    const { data } = await supabase.from("tardeos").select("id,local_id").in("id", idsTardeo);
    for (const t of data ?? []) if (t.local_id) localDeTardeo[t.id] = t.local_id;
  }

  const ahora = new Date();
  const promos: Record<string, number> = {};
  for (const x of (pr.data ?? []) as any[]) {
    const viva =
      (!x.desde || new Date(x.desde) <= ahora) &&
      (!x.hasta || new Date(x.hasta) >= ahora) &&
      (x.limite_usos == null || (x.usos ?? 0) < x.limite_usos);
    if (!viva) continue;
    const lid = x.local_id ?? localDeTardeo[x.tardeo_id];
    if (lid) promos[lid] = (promos[lid] ?? 0) + 1;
  }

  const salida: Record<string, Consumo> = {};
  for (const [localId, p] of Object.entries(planes)) {
    const c = CUOTAS[plan(p)];
    const eMes = eventos[localId] ?? 0;
    const pAct = promos[localId] ?? 0;
    const eDeMas = c.eventosMes == null ? 0 : Math.max(0, eMes - c.eventosMes);
    const pDeMas = c.promosSimultaneas == null ? 0 : Math.max(0, pAct - c.promosSimultaneas);
    salida[localId] = {
      eventosMes: eMes, promosActivas: pAct,
      eventosDeMas: eDeMas, promosDeMas: pDeMas,
      euros: eDeMas * PRECIO_EXTRA.evento + pDeMas * PRECIO_EXTRA.promocion,
    };
  }
  return salida;
}
