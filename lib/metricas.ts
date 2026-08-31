"use client";

import { supabase } from "./supabase";

/**
 * Registrar lo que pasa, con su hora.
 *
 * Antes solo existía un contador acumulado por tardeo. Un número que sube no
 * sirve para nada de lo que vende el modelo de suscripciones: ni comparar
 * meses, ni ver evolución, ni calcular CTR. Y la historia que no se guarda hoy
 * no se recupera: por eso esto es lo primero que había que montar.
 *
 * Se mide para TODOS los planes a propósito. Medir es barato; lo que cambia
 * según el plan es qué estadísticas puede CONSULTAR el local. Si solo midieras
 * a los que pagan, nunca podrías enseñarle a un Basic lo que se está perdiendo.
 */
export type TipoMetrica =
  | "vista_tardeo" | "vista_local" | "vista_dj"
  | "clic_entrada" | "clic_lista" | "inscripcion" | "favorito"
  // Por dónde entra la gente
  | "vista_home" | "vista_listado" | "vista_mapa"
  // Qué busca y con qué filtra
  | "busqueda" | "busqueda_vacia" | "filtro"
  // Si las recomendaciones sirven
  | "para_ti_visto" | "para_ti_clic";

/**
 * Identificador de la pestaña. Al azar, sin nada de la persona, y muere al
 * cerrar el navegador. Solo sirve para no contar diez veces a quien recarga.
 */
function sesion(): string {
  try {
    const CLAVE = "tc-sesion";
    let s = sessionStorage.getItem(CLAVE);
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(CLAVE, s);
    }
    return s;
  } catch {
    // Sin sessionStorage (modo privado, cookies bloqueadas) se mide igual, solo
    // que sin poder agrupar las visitas de esa persona.
    return "";
  }
}

/** Que una vista no cuente dos veces en la misma pestaña. */
function yaContado(clave: string): boolean {
  try {
    const k = `tc-visto-${clave}`;
    if (sessionStorage.getItem(k)) return true;
    sessionStorage.setItem(k, "1");
    return false;
  } catch {
    return false;
  }
}

/**
 * Apunta un evento. NUNCA revienta ni bloquea: medir es importante, pero no
 * tanto como que la página funcione. Si la tabla aún no existe o falla la red,
 * se pierde ese dato y ya está.
 */
export async function medir(
  tipo: TipoMetrica,
  refs: {
    tardeoId?: string; localId?: string; djId?: string; destino?: string;
    /**
     * El texto de una búsqueda o el nombre de un filtro.
     *
     * Se recorta a 80 y se pasa a minúsculas AQUÍ y no en cada sitio que
     * llama: es texto escrito por personas, y el día que a alguien se le
     * ocurra medir otro campo libre, el recorte ya estará puesto.
     */
    detalle?: string;
  },
  opciones: { unaVezPorSesion?: boolean } = {}
): Promise<void> {
  try {
    const clave = `${tipo}-${refs.tardeoId ?? refs.localId ?? refs.djId ?? ""}`;
    if (opciones.unaVezPorSesion && yaContado(clave)) return;

    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("eventos_metrica").insert({
      tipo,
      tardeo_id: refs.tardeoId ?? null,
      local_id: refs.localId ?? null,
      dj_id: refs.djId ?? null,
      profile_id: session?.user?.id ?? null,
      sesion: sesion(),
      destino: refs.destino ?? null,
      detalle: refs.detalle ? refs.detalle.trim().toLowerCase().slice(0, 80) : null,
    });
  } catch {
    /* medir nunca puede romper la página */
  }
}
