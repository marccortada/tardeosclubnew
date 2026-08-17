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
  /** A qué va la gente: chill, afterwork, fiestero… Varios a la vez. */
  ambiente?: string[];
  /** Franjas de edad a las que apunta el tardeo. Varias a la vez. Opcional
   *  porque la inmensa mayoría de los migrados no lo trae. */
  publico?: string[];
  /** Cómo se va vestido. Texto libre: la lista de lib/adn es una sugerencia. */
  dressCode?: string;
  destacado: boolean;
  estado?: string; // publicado | borrador | finalizado | cancelado
  lat: number;
  lng: number;
  flyer?: string; // URL del flyer (de Supabase); si falta, se deriva del id (mock)
  // colores para el flyer generado por CSS (legado)
  flyerFrom: string;
  flyerTo: string;
}
