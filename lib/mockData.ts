import { Tardeo, Dj, Local } from "./types";

export type { Tardeo, Dj, Local, TipoEntrada } from "./types";

export const ZONAS = ["Barcelona", "Maresme", "Costa Brava", "Baix Llobregat"];
export const ESTILOS = ["Remember", "Latino", "Comercial", "House", "Rumba", "Años 80-90"];

const djs: Dj[] = [
  { id: "dj1", nombre: "DJ Nando", estilos: ["Remember", "House"], verificado: true, reputacion: 4.8 },
  { id: "dj2", nombre: "DJ Marta Sound", estilos: ["Latino", "Comercial"], verificado: true, reputacion: 4.5 },
  { id: "dj3", nombre: "DJ Kiko", estilos: ["Años 80-90", "Remember"], verificado: false, reputacion: 4.2 },
  { id: "dj4", nombre: "DJ Rumba Viva", estilos: ["Rumba", "Latino"], verificado: true, reputacion: 4.9 },
  { id: "dj5", nombre: "DJ Sonia", estilos: ["House", "Comercial"], verificado: false, reputacion: 4.0 },
];

const locales: Local[] = [
  { id: "l1", nombre: "Sala Blau", zona: "Barcelona", direccion: "C/ Marina 120, Barcelona", verificado: true },
  { id: "l2", nombre: "Chiringuito La Marea", zona: "Maresme", direccion: "Passeig Marítim 8, Mataró", verificado: true },
  { id: "l3", nombre: "Terraza Costa", zona: "Costa Brava", direccion: "Av. del Mar 45, Lloret de Mar", verificado: false },
  { id: "l4", nombre: "El Patio Latino", zona: "Barcelona", direccion: "C/ Gran Via 500, Barcelona", verificado: true },
  { id: "l5", nombre: "Beach Club Sol", zona: "Maresme", direccion: "Passeig del Callao 2, Calella", verificado: true },
  { id: "l6", nombre: "Masia Fest", zona: "Baix Llobregat", direccion: "Ctra. Sant Boi 12, Sant Boi", verificado: false },
];

const paletas = [
  { from: "#E10A5A", to: "#F5B301" },
  { from: "#7A0033", to: "#E10A5A" },
  { from: "#F5B301", to: "#EE3E80" },
  { from: "#2A1721", to: "#E10A5A" },
  { from: "#C00040", to: "#FBC63A" },
  { from: "#EE3E80", to: "#F5B301" },
];

export const TARDEOS: Tardeo[] = [
  {
    id: "t1", titulo: "Tardeo Remember Sunset", local: locales[0], djs: [djs[0], djs[2]],
    fecha: "2026-07-11", horaInicio: "18:00", horaFin: "23:00", zona: "Barcelona",
    estilo: "Remember", tipoEntrada: "pago", precio: 12, destacado: true,
    lat: 41.3908, lng: 2.196, flyerFrom: paletas[0].from, flyerTo: paletas[0].to,
  },
  {
    id: "t2", titulo: "Latino Beach Party", local: locales[1], djs: [djs[1], djs[3]],
    fecha: "2026-07-12", horaInicio: "17:30", horaFin: "22:30", zona: "Maresme",
    estilo: "Latino", tipoEntrada: "lista", destacado: true,
    lat: 41.5388, lng: 2.4449, flyerFrom: paletas[1].from, flyerTo: paletas[1].to,
  },
  {
    id: "t3", titulo: "Tardeo del Mar", local: locales[2], djs: [djs[4]],
    fecha: "2026-07-12", horaInicio: "18:00", horaFin: "23:30", zona: "Costa Brava",
    estilo: "House", tipoEntrada: "gratis", destacado: false,
    lat: 41.7, lng: 2.845, flyerFrom: paletas[2].from, flyerTo: paletas[2].to,
  },
  {
    id: "t4", titulo: "Rumba y Salsa Tarde", local: locales[3], djs: [djs[3]],
    fecha: "2026-07-13", horaInicio: "19:00", horaFin: "23:00", zona: "Barcelona",
    estilo: "Rumba", tipoEntrada: "pago", precio: 10, destacado: true,
    lat: 41.3775, lng: 2.148, flyerFrom: paletas[4].from, flyerTo: paletas[4].to,
  },
  {
    id: "t5", titulo: "Años 80-90 Fiesta", local: locales[4], djs: [djs[2], djs[0]],
    fecha: "2026-07-18", horaInicio: "18:00", horaFin: "22:00", zona: "Maresme",
    estilo: "Años 80-90", tipoEntrada: "lista", destacado: false,
    lat: 41.6142, lng: 2.6558, flyerFrom: paletas[3].from, flyerTo: paletas[3].to,
  },
  {
    id: "t6", titulo: "House Sunset Session", local: locales[2], djs: [djs[4], djs[1]],
    fecha: "2026-07-19", horaInicio: "18:30", horaFin: "23:59", zona: "Costa Brava",
    estilo: "House", tipoEntrada: "pago", precio: 15, destacado: false,
    lat: 41.702, lng: 2.848, flyerFrom: paletas[5].from, flyerTo: paletas[5].to,
  },
  {
    id: "t7", titulo: "Comercial Hits Tarde", local: locales[5], djs: [djs[4]],
    fecha: "2026-07-20", horaInicio: "17:00", horaFin: "21:30", zona: "Baix Llobregat",
    estilo: "Comercial", tipoEntrada: "gratis", destacado: false,
    lat: 41.345, lng: 2.037, flyerFrom: paletas[0].from, flyerTo: paletas[0].to,
  },
  {
    id: "t8", titulo: "Gran Tardeo Verano", local: locales[0], djs: [djs[0], djs[3], djs[1]],
    fecha: "2026-07-25", horaInicio: "18:00", horaFin: "23:59", zona: "Barcelona",
    estilo: "Remember", tipoEntrada: "pago", precio: 18, destacado: true,
    lat: 41.3905, lng: 2.1954, flyerFrom: paletas[1].from, flyerTo: paletas[1].to,
  },
];

/**
 * Zonas DINÁMICAS: se derivan de los tardeos publicados, no de una lista fija.
 * Cuando un local aprobado crea un tardeo en una zona nueva, aparece sola aquí
 * (y por tanto en los filtros y en "Explora por zona"). No hay que predefinirla.
 */
export function zonasActivas(): string[] {
  return Array.from(new Set(TARDEOS.map((t) => t.zona))).sort((a, b) => a.localeCompare(b, "es"));
}

export function getTardeo(id: string): Tardeo | undefined {
  return TARDEOS.find((t) => t.id === id);
}

// Fuente del flyer: la URL real (Supabase) o, si falta, la del mock por id
export function flyerSrc(t: Tardeo): string {
  return t.flyer ?? `/flyers/${t.id}.jpg?v=3`;
}

// Local de demo (el que ha iniciado sesión) y sus tardeos
export const LOCAL_ACTUAL = locales[0]; // Sala Blau · Barcelona
export function tardeosDeLocal(localId: string): Tardeo[] {
  return TARDEOS.filter((t) => t.local.id === localId);
}

export function formatFecha(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
