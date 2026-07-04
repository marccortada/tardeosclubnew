export type TipoEntrada = "gratis" | "pago" | "lista";

export interface Dj {
  id: string;
  nombre: string;
  estilos: string[];
  verificado: boolean;
  reputacion: number; // 0-5
}

export interface Local {
  id: string;
  nombre: string;
  zona: string;
  direccion: string;
  verificado: boolean;
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
  destacado: boolean;
  lat: number;
  lng: number;
  flyer?: string; // URL del flyer (de Supabase); si falta, se deriva del id (mock)
  // colores para el flyer generado por CSS (legado)
  flyerFrom: string;
  flyerTo: string;
}
