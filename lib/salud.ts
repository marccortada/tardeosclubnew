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
};

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
      const { error, count } = await supabase.from("tardeos").select("id", { count: "exact", head: true });
      if (!error) datos.tardeos = count ?? 0;
      return { error, nota: `${count ?? 0} tardeos en total` };
    }),

    comprobar("Métricas por evento", "Pega supabase/34_metricas_eventos.sql", async () => {
      const { error, count } = await supabase.from("eventos_metrica").select("id", { count: "exact", head: true });
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
        .from("denuncias_flyer").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
      if (!error) datos.denuncias = count ?? 0;
      return { error, nota: `${count ?? 0} pendientes` };
    }),

    comprobar("Moderación de reseñas", "Pega supabase/44_resenas_moderacion.sql", async () => {
      // Se pide la consulta EXACTA del panel de moderación, con las columnas
      // nuevas. Si falta el lote, PostgREST responde 42703 por la primera
      // columna que no existe, que es justo lo que hay que detectar.
      const { error, count } = await supabase
        .from("resenas")
        .select("id,estado,motivo_rechazo,apelacion,apelada_en,moderada_por,moderada_en", { count: "exact", head: true })
        .in("estado", ["pendiente", "apelada"]);
      if (!error) datos.resenasPendientes = count ?? 0;
      return { error, nota: `${count ?? 0} pendientes o apeladas` };
    }),

    comprobar("Seguimiento comercial", "Pega supabase/35_crm_comercial.sql", async () => {
      const { error } = await supabase.from("seguimiento_comercial").select("local_id").limit(1);
      return { error };
    }),
  ]);

  // Lo que no es un fallo técnico pero deja la web vacía, que para quien la
  // mira es lo mismo. Va aquí porque es donde alguien viene a preguntarse por
  // qué la web «no funciona».
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const { count: futuros } = await supabase
    .from("tardeos").select("id", { count: "exact", head: true })
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
    .from("locales").select("id", { count: "exact", head: true }).neq("estado", "activo");
  datos.sinAprobar = sinAprobar ?? 0;
  pruebas.push({
    nombre: "Locales sin aprobar",
    ok: (sinAprobar ?? 0) === 0,
    detalle: `${sinAprobar ?? 0} fichas fuera de la web`,
    arreglo: (sinAprobar ?? 0) > 0
      ? "Sus tardeos salen sin nombre de local. Se aprueban en Colaboradores."
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
