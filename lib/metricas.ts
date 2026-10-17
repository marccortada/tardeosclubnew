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
  | "para_ti_visto" | "para_ti_clic"
  /**
   * Contacto con el local por cualquier vía: el canal va en `detalle`
   * ('whatsapp', 'instagram', 'web', 'reservas', 'mapa', 'taxi').
   *
   * Un tipo y no seis: añadir un canal nuevo no debe obligar a tocar la
   * restricción de la base ni las consultas que agrupan por tipo.
   */
  | "clic_contacto"
  // Dossier pág. 16 (lote 69): acciones del recorrido nuevo
  | "seguir" | "play" | "asistire" | "espera" | "meet_entrar" | "clic_externo"
  | "sorteo_participar" | "aviso_abierto";

/** Los canales que se miden dentro de `clic_contacto`. */
export type Canal = "whatsapp" | "instagram" | "web" | "reservas" | "mapa" | "taxi";

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

/**
 * Origen de campaña (Ruta del Tardeo, WhatsApp, IG, QR…): se lee de la URL al
 * entrar (`utm_source|medium|campaign` o el corto `?o=`) y se guarda en la
 * pestaña, así todos los eventos de esa visita llevan el mismo origen. Solo
 * etiquetas de campaña: nunca datos personales en la URL. Primer toque gana:
 * navegar dentro de la web no lo pisa.
 */
type Origen = { origen: string | null; medio: string | null; campana: string | null };
const ETIQUETA = /^[a-z0-9._-]{1,60}$/i;
export function origenDeVisita(): Origen {
  const vacio: Origen = { origen: null, medio: null, campana: null };
  try {
    const CLAVE = "tc-origen";
    const guardado = sessionStorage.getItem(CLAVE);
    if (guardado) return JSON.parse(guardado) as Origen;
    const q = new URLSearchParams(window.location.search);
    const limpio = (v: string | null) => (v && ETIQUETA.test(v.trim()) ? v.trim().toLowerCase() : null);
    const o: Origen = {
      origen: limpio(q.get("utm_source")) ?? limpio(q.get("o")),
      medio: limpio(q.get("utm_medium")),
      campana: limpio(q.get("utm_campaign")),
    };
    if (o.origen || o.campana) sessionStorage.setItem(CLAVE, JSON.stringify(o));
    return o.origen || o.campana ? o : vacio;
  } catch {
    return vacio;
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

    const o = origenDeVisita();
    const detalle = refs.detalle ? refs.detalle.trim().toLowerCase().slice(0, 80) : null;
    // Lote 69: el servidor deduplica (pestaña + tipo + objeto + día) y marca
    // al equipo. Si el lote aún no está, se inserta como antes.
    const r = await supabase.rpc("medir_evento", {
      p_tipo: tipo, p_tardeo: refs.tardeoId ?? null, p_local: refs.localId ?? null, p_dj: refs.djId ?? null,
      p_sesion: sesion(), p_destino: refs.destino ?? null, p_detalle: detalle,
      p_origen: o.origen, p_medio: o.medio, p_campana: o.campana,
    });
    // Desde el lote 73 solo se puede medir por la función: el insert directo a
    // la tabla está cerrado (dejaba a cualquiera llenar la base de basura).
    // Si la función fallara, se pierde esa medición y la página sigue igual.
    void r;
  } catch {
    /* medir nunca puede romper la página */
  }
}
