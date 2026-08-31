export type TipoEntrada = "gratis" | "pago" | "lista";

export interface Dj {
  id: string;
  nombre: string;
  estilos: string[];
  verificado: boolean;
  reputacion: number; // 0-5
  avatar?: string;
}

export interface Local {
  id: string;
  nombre: string;
  zona: string;
  direccion: string;
  verificado: boolean;
  /** Logo del local. Si lo tiene, es lo que sale en la chincheta del mapa. */
  logo?: string;
  /**
   * "promotor" organiza fiestas sin local fijo: su ficha no tiene dirección
   * propia y el sitio lo pone cada tardeo.
   */
  tipo: "local" | "promotor";
  /** Su plan de suscripción. Decide si sale su logo y su sello, pero solo
   *  cuando las reglas están encendidas (lib/ajustes.ts). */
  plan?: string;
}

export interface Tardeo {
  id: string;
  titulo: string;
  local: Local;
  djs: Dj[];
  fecha: string; // ISO
  horaInicio: string;
  horaFin: string;
  zona: string;
  estilo: string;
  tipoEntrada: TipoEntrada;
  precio?: number;
  /** Dónde se compra la entrada o se apunta uno a la lista. Se llama
   *  `fourvenues_url` en la base por la app antigua, pero guarda el enlace de
   *  cualquier ticketera: hay Entradium, Resident Advisor, CodeTickets… */
  urlEntradas?: string;
  /** Promoción que pone el local, visible SOLO dentro de esta ficha. */
  promoTitulo?: string;
  promoTexto?: string;
  /** Etiquetas cortas: 2x1, chicas gratis… */
  etiquetas?: string[];
  /** Tardeo, mañaneo, brunch, nocheo… Uno solo. */
  tipoEvento?: string;
  /** A qué va la gente: chill, afterwork, fiestero… Varios a la vez. */
  ambiente?: string[];
  /** Franjas de edad a las que apunta el tardeo. Varias a la vez. Opcional
   *  porque la inmensa mayoría de los migrados no lo trae. */
  publico?: string[];
  /** Cómo se va vestido. Texto libre: la lista de lib/adn es una sugerencia. */
  dressCode?: string;
  destacado: boolean;
  estado?: string; // borrador | programado | publicado | finalizado | cancelado
  /** Cuándo sale solo, si está programado (ISO). */
  publicarEn?: string;
  lat: number;
  lng: number;
  flyer?: string; // URL del flyer (de Supabase); si falta, se deriva del id (mock)
  // colores para el flyer generado por CSS (legado)
  flyerFrom: string;
  flyerTo: string;
}
