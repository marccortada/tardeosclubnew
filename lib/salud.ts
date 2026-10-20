"use client";

import { supabase } from "./supabase";

/**
 * ¿Está bien la web ahora mismo?
 *
 * El fallo que más veces nos ha mordido en este proyecto no es un error de
 * programación: es un lote de SQL sin pegar. La pantalla no revienta —está
 * escrita para no reventar— así que simplemente falta un bloque, o los
 * contadores dan de menos, y nadie se entera hasta que alguien lo mira por
 * casualidad. Eso es exactamente lo que señala Q-06.
 *
 * Aquí se comprueba cada pieza de una en una y se dice cuál falta y qué
 * fichero hay que pegar. No sustituye a un servicio de vigilancia, pero
 * convierte «algo va raro» en «falta el lote 41».
 */

export type Prueba = {
  nombre: string;
  ok: boolean;
  detalle: string;
  /** Qué hay que hacer si sale mal. */
  arreglo?: string;
  /**
   * No se ha podido saber desde la web (sin el lote 51). No cuenta como fallo
   * —no se puede afirmar que falte— pero se enseña para que no pase por bueno.
   */
  sinComprobar?: boolean;
};

type ErrorPg = { code?: string; message?: string } | null;

/**
 * Lo que dice el catálogo de Postgres sobre disparadores, restricciones y
 * políticas (lote 51). `null` si esa función aún no está: entonces esas
 * piezas quedan "sin comprobar", que no es lo mismo que "faltan".
 */
type Catalogo = { l41_disparador?: boolean; l43_estado_oculto?: boolean; l46_politica_push?: boolean } | null;

const ARREGLO_51 = "Para comprobarlo desde aquí, pega supabase/51_salud_lotes.sql (solo lectura).";

/** Llama a una función con argumentos que no escriben nada. Existe si el error no es "no existe". */
const existeFuncion = (error: ErrorPg): ErrorPg =>
  !error || !NO_EXISTE.has(error.code ?? "") ? null : error;

/** Códigos que significan «eso todavía no existe en la base». */
const NO_EXISTE = new Set(["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]);

async function comprobar(
  nombre: string,
  arreglo: string,
  fn: () => Promise<{ error: { code?: string; message?: string } | null; nota?: string }>
): Promise<Prueba> {
  try {
    const { error, nota } = await fn();
    if (!error) return { nombre, ok: true, detalle: nota ?? "Correcto" };
    if (NO_EXISTE.has(error.code ?? "")) {
      return { nombre, ok: false, detalle: "No existe todavía en la base.", arreglo };
    }
    // Un error de permisos NO es un fallo de salud: significa que la seguridad
    // está haciendo su trabajo con quien no debería ver eso.
    if (error.code === "42501") return { nombre, ok: true, detalle: "Protegido por permisos (correcto)." };
    return { nombre, ok: false, detalle: error.message ?? "Error desconocido.", arreglo };
  } catch (e) {
    return { nombre, ok: false, detalle: String(e), arreglo };
  }
}

export async function revisarSalud(): Promise<{ pruebas: Prueba[]; datos: Record<string, number> }> {
  const datos: Record<string, number> = {};

  const pruebas = await Promise.all([
    comprobar("Conexión con la base", "Revisa las credenciales del servidor.", async () => {
      const { error, count } = await supabase.from("tardeos").select("id", { count: "exact" }).limit(0);
      if (!error) datos.tardeos = count ?? 0;
      return { error, nota: `${count ?? 0} tardeos en total` };
    }),

    // No es de la base: la clave pública de push se incrusta al COMPILAR. Si el
    // build se hizo sin ella, nadie puede activar las notificaciones y nada
    // más avisa (pasó el 15-oct). scripts/desplegar.sh ya la lee del servidor.
    comprobar("Notificaciones push en la web", "Vuelve a desplegar con bash scripts/desplegar.sh (lee la clave del .env del servidor).", async () =>
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ? { error: null, nota: "La web lleva la clave pública" }
        : { error: { message: "Esta versión de la web se compiló sin NEXT_PUBLIC_VAPID_PUBLIC_KEY: «Activar notificaciones» no puede funcionar." } }),

    comprobar("Métricas por evento", "Pega supabase/34_metricas_eventos.sql", async () => {
      const { error, count } = await supabase.from("eventos_metrica").select("id", { count: "exact" }).limit(0);
      if (!error) datos.metricas = count ?? 0;
      return { error, nota: `${count ?? 0} acciones registradas` };
    }),

    comprobar("Resumen del panel de estadísticas", "Pega supabase/36_metricas_ampliadas.sql", async () => {
      const { error } = await supabase.rpc("metricas_resumen", { p_dias: 7 });
      return { error };
    }),

    comprobar("Estadísticas del local (7/30/90)", "Pega supabase/39_ventana_metricas_local.sql", async () => {
      const { error } = await supabase.rpc("metricas_local", {
        p_local: "00000000-0000-0000-0000-000000000000", p_dias: 30,
      });
      return { error };
    }),

    comprobar("Orden manual de destacados", "Pega supabase/37_orden_destacados.sql", async () => {
      const { error } = await supabase.from("tardeos").select("destacado_orden").limit(1);
      return { error };
    }),

    comprobar("Permiso para mandar ofertas", "Pega supabase/38_consentimiento_ofertas.sql", async () => {
      const { error } = await supabase.from("profiles").select("acepta_ofertas").limit(1);
      return { error };
    }),

    comprobar("Clics de contacto", "Pega supabase/40_clics_de_contacto.sql", async () => {
      // No se escribe nada: se pregunta si la restricción admite el tipo.
      const { error } = await supabase.from("eventos_metrica").select("id").eq("tipo", "clic_contacto").limit(1);
      return { error };
    }),

    comprobar("Denuncias de flyers", "Pega supabase/42_denuncias_flyer.sql", async () => {
      const { error, count } = await supabase
        .from("denuncias_flyer").select("id", { count: "exact" }).limit(0).eq("estado", "pendiente");
      if (!error) datos.denuncias = count ?? 0;
      return { error, nota: `${count ?? 0} pendientes` };
    }),

    comprobar("Moderación de reseñas", "Pega supabase/44_resenas_moderacion.sql", async () => {
      // Se pide la consulta EXACTA del panel de moderación, con las columnas
      // nuevas. Si falta el lote, PostgREST responde 42703 por la primera
      // columna que no existe, que es justo lo que hay que detectar.
      const { error, count } = await supabase
        .from("resenas")
        .select("id,estado,motivo_rechazo,apelacion,apelada_en,moderada_por,moderada_en", { count: "exact" }).limit(0)
        .in("estado", ["pendiente", "apelada"]);
      if (!error) datos.resenasPendientes = count ?? 0;
      return { error, nota: `${count ?? 0} pendientes o apeladas` };
    }),

    comprobar("Seguimiento comercial", "Pega supabase/35_crm_comercial.sql", async () => {
      const { error } = await supabase.from("seguimiento_comercial").select("local_id").limit(1);
      return { error };
    }),

    comprobar("Reordenar destacados de una vez (lote 45)", "Pega supabase/45_destacados_orden.sql", async () => {
      // Tabla no permitida + lista vacía: la función rechaza antes de tocar
      // nada (o por permisos). Solo interesa saber si existe.
      const { error } = await supabase.rpc("reordenar_destacados", { p_tabla: "comprobacion", p_ids: [] });
      return { error: existeFuncion(error) };
    }),

    comprobar("Recordatorios sin duplicados (lote 46)", "Pega supabase/46_seguridad.sql", async () => {
      // Tiene RLS sin políticas: con permisos normales responde vacío, sin error.
      const { error } = await supabase.from("recordatorios_enviados").select("tardeo_id").limit(0);
      return { error };
    }),

    comprobar("PressKit de DJs (lote 47)", "Pega supabase/47_presskit_y_arreglos.sql", async () => {
      // Con el lote 65 la columna ya no se lee directamente (42501): eso
      // también prueba que existe.
      const { error } = await supabase.from("djs").select("presskit_url").limit(0);
      return { error: error?.code === "42501" ? null : error };
    }),

    comprobar("Planes caídos (lote 47)", "Pega supabase/47_presskit_y_arreglos.sql", async () => {
      const { error } = await supabase.rpc("locales_con_plan_caido");
      return { error: existeFuncion(error) };
    }),

    comprobar("Aforo y asistencia (lote 48)", "Pega supabase/48_reservas_aforo_asistencia.sql", async () => {
      const [t, i, r] = await Promise.all([
        supabase.from("tardeos").select("aforo").limit(0),
        supabase.from("inscripciones").select("asistencia,asistencia_en").limit(0),
        supabase.rpc("plazas_de_tardeo", { p_tardeo: "00000000-0000-0000-0000-000000000000" }),
      ]);
      return { error: t.error ?? i.error ?? existeFuncion(r.error) };
    }),

    // Versión 2.0 (dossier 14‑oct): una comprobación por lote con lo que el
    // código usa de él. Leer con limit(0) no trae datos; las RPC se llaman
    // con argumentos que no escriben.
    comprobar("Base 2.0: zonas, avisos, auditoría, denuncias (lote 63)", "Pega supabase/63_base_v2.sql", async () => {
      const [z, a, d, p] = await Promise.all([
        supabase.from("zonas").select("slug,zona_madre").limit(0),
        supabase.from("auditoria").select("id").limit(0),
        supabase.from("denuncias").select("id").limit(0),
        supabase.rpc("es_profesional"),
      ]);
      return { error: z.error ?? a.error ?? d.error ?? existeFuncion(p.error) };
    }),
    comprobar("Asistiré y lista de espera (lote 64)", "Pega supabase/64_asistire_espera.sql", async () => {
      const [i, v] = await Promise.all([
        supabase.from("inscripciones").select("espera_desde").limit(0),
        supabase.from("popups_vistos").select("*").limit(0),
      ]);
      return { error: i.error ?? v.error };
    }),
    comprobar("Música: sets y seguidores (lote 65)", "Pega supabase/65_musica.sql", async () => {
      const [a, b] = await Promise.all([
        supabase.from("sets").select("id").limit(0),
        supabase.from("seguidores_dj").select("dj_id").limit(0),
      ]);
      return { error: a.error ?? b.error };
    }),
    comprobar("Comunidad: Meet Zone y mensajes (lote 66)", "Pega supabase/66_comunidad.sql", async () => {
      const [a, b] = await Promise.all([
        supabase.from("meet_mensajes").select("id").limit(0),
        supabase.from("solicitudes_mensaje").select("id").limit(0),
      ]);
      return { error: a.error ?? b.error };
    }),
    comprobar("Retorno: encuestas y sorteos (lote 67)", "Pega supabase/67_retorno.sql", async () => {
      const [a, b] = await Promise.all([
        supabase.from("encuestas").select("id").limit(0),
        supabase.from("sorteos").select("id").limit(0),
      ]);
      return { error: a.error ?? b.error };
    }),
    comprobar("Profesional: Coins y solicitudes de DJ (lote 68)", "Pega supabase/68_profesional_negocio.sql", async () => {
      const [a, b] = await Promise.all([
        supabase.from("coins_reservas").select("id").limit(0),
        supabase.from("dj_solicitudes").select("id").limit(0),
      ]);
      return { error: a.error ?? b.error };
    }),
    comprobar("Admin por zonas, colas y medición (lote 69)", "Pega supabase/69_admin_zonas.sql", async () => {
      const [r, l, m, g, c] = await Promise.all([
        supabase.from("admin_roles").select("id").limit(0),
        supabase.from("locales").select("zona_slug").limit(0),
        supabase.from("eventos_metrica").select("origen,es_equipo,dia").limit(0),
        supabase.rpc("es_admin_global"),
        supabase.rpc("cohortes_retorno", { p_semanas: 1 }),
      ]);
      return { error: r.error ?? l.error ?? m.error ?? existeFuncion(g.error) ?? existeFuncion(c.error) };
    }),
    // El 70 solo borra índices duplicados (no se ve desde la web) y va en el
    // mismo paquete que el 71, así que se da por puesto si el 71 lo está. El
    // 71 cambia feed_djs para que salgan también los DJs sin set ni evento:
    // si alguna fila llega sin los dos, está aplicado; si el feed trae menos
    // DJs de los que hay (sin llegar al tope pedido), falta.
    comprobar("Feed de DJs completo e índices (lotes 70 y 71)", "Pega supabase/PEGAR_70_71.sql", async () => {
      const TOPE = 50;
      const [f, d] = await Promise.all([
        supabase.rpc("feed_djs", { p_limite: TOPE }),
        // Los mismos que puede enseñar el feed: los ocultos no salen nunca.
        supabase.from("djs").select("id", { count: "exact" }).limit(0).eq("oculto", false),
      ]);
      if (f.error) return { error: f.error };
      const filas = (f.data ?? []) as { set_id: string | null; evento_id: string | null }[];
      if (filas.some((x) => !x.set_id && !x.evento_id)) return { error: null, nota: "Correcto: salen también los DJs sin set" };
      if (filas.length < TOPE && (d.count ?? 0) > filas.length) {
        return { error: { message: `El feed solo enseña ${filas.length} de ${d.count} DJs (los que tienen set o evento).` } };
      }
      return { error: null, nota: "Correcto" };
    }),
    // Lote 73 (arreglos de la auditoría): casi todo son funciones y políticas
    // que no se ven leyendo; se comprueban dos piezas nuevas que sí: la marca
    // de rechazos por bloqueo y el total de la cola de trabajo.
    comprobar("Arreglos de la auditoría (lote 73)", "Pega supabase/PEGAR_73.sql", async () => {
      const [s, c] = await Promise.all([
        supabase.from("solicitudes_mensaje").select("por_bloqueo").limit(0),
        supabase.rpc("cola_trabajo_total", { p_tipo: null, p_zona: null, p_solo_mias: false, p_estado: "abiertas" }),
      ]);
      return { error: s.error ?? existeFuncion(c.error) };
    }),
    // Lote 75: gestionar la asistencia desde la ficha del tardeo (el local da
    // plaza, pasa a espera o cancela). Sin él, la lista se ve igual pero esas
    // acciones solo le funcionan al admin.
    comprobar("Asistencia desde la ficha del tardeo (lote 75)", "Pega supabase/PEGAR_75.sql", async () => {
      const { error } = await supabase.rpc("lista_de_tardeo", { p_tardeo: "00000000-0000-0000-0000-000000000000" });
      return { error: existeFuncion(error) };
    }),
    // Lote 78: los emails y los datos de cobro de las fichas se piden por esta
    // función (lib/privados.ts). Sin ella, el código lee las columnas como antes.
    comprobar("Datos privados de las fichas (lote 78)", "Aplica supabase/PEGAR_78.sql", async () => {
      const { error } = await supabase.rpc("datos_privados_locales", { p_ids: [] });
      return { error: existeFuncion(error) };
    }),
  ]);

  // Lotes que solo crean disparadores, restricciones o políticas: no se ven
  // leyendo. Se pregunta al catálogo (lote 51) y, si no está, se dice.
  let catalogo: Catalogo = null;
  try {
    const { data, error } = await supabase.rpc("salud_lotes");
    if (!error && data && typeof data === "object") catalogo = data as Catalogo;
  } catch { /* se queda en null */ }

  // Pista sin el lote 51: si ya hay fichas en 'oculto', la restricción del 43 lo admite.
  const { count: ocultos } = await supabase
    .from("locales").select("id", { count: "exact" }).limit(0).eq("estado", "oculto");

  const pieza = (nombre: string, valor: boolean | undefined, arreglo: string, pista?: boolean): Prueba => {
    if (pista) return { nombre, ok: true, detalle: "Correcto (hay fichas que ya lo usan)." };
    if (catalogo === null || valor === undefined) {
      return { nombre, ok: true, sinComprobar: true, detalle: "No se puede comprobar desde la web.", arreglo: ARREGLO_51 };
    }
    return valor ? { nombre, ok: true, detalle: "Correcto" } : { nombre, ok: false, detalle: "No está aplicado en la base.", arreglo };
  };
  pruebas.push(
    pieza("Estados de local coherentes (lote 41)", catalogo?.l41_disparador,
      "Pega supabase/41_estados_coherentes.sql y después supabase/43_ocultar_sin_impago.sql"),
    pieza("Ocultar sin acusar de impago (lote 43)", catalogo?.l43_estado_oculto,
      "Pega supabase/43_ocultar_sin_impago.sql. Sin él, «Ocultar» en Locales falla.", (ocultos ?? 0) > 0),
    pieza("Altas de push solo de servicios reales (lote 46)", catalogo?.l46_politica_push,
      "Pega supabase/46_seguridad.sql"),
  );

  // Lo que no es un fallo técnico pero deja la web vacía, que para quien la
  // mira es lo mismo. Va aquí porque es donde alguien viene a preguntarse por
  // qué la web «no funciona».
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const { count: futuros } = await supabase
    .from("tardeos").select("id", { count: "exact" }).limit(0)
    .eq("estado", "publicado").gte("fecha", hoy);
  datos.futuros = futuros ?? 0;
  pruebas.push({
    nombre: "Tardeos futuros publicados",
    ok: (futuros ?? 0) >= 5,
    detalle: `${futuros ?? 0} publicados de hoy en adelante`,
    arreglo: (futuros ?? 0) < 5
      ? "Con menos de cinco, los filtros devuelven listas vacías y la web parece rota aunque funcione."
      : undefined,
  });

  const { count: sinAprobar } = await supabase
    .from("locales").select("id", { count: "exact" }).limit(0).neq("estado", "activo");
  datos.sinAprobar = sinAprobar ?? 0;
  pruebas.push({
    nombre: "Locales sin aprobar",
    ok: (sinAprobar ?? 0) === 0,
    detalle: `${sinAprobar ?? 0} fichas fuera de la web`,
    arreglo: (sinAprobar ?? 0) > 0
      ? "Sus tardeos salen sin nombre de local. Se aprueban en Administración → Por revisar."
      : undefined,
  });

  // Una cola de moderación que crece es un problema de negocio, no técnico:
  // una reseña sin aprobar no la ve nadie, así que quien la escribió cree que
  // se ha perdido. Va aquí porque es donde se viene a mirar qué falla.
  if ((datos.resenasPendientes ?? 0) > 0) {
    pruebas.push({
      nombre: "Cola de moderación",
      ok: (datos.resenasPendientes ?? 0) <= 10,
      detalle: `${datos.resenasPendientes} reseñas esperando`,
      arreglo: (datos.resenasPendientes ?? 0) > 10
        ? "Se moderan en Moderación. Mientras no se aprueben, no las ve nadie."
        : undefined,
    });
  }

  return { pruebas, datos };
}
