/**
 * Agrupa lo que hay en `tardeos.zona` en unas pocas zonas grandes.
 *
 * El campo llega con granularidades mezcladas: el seed guardaba comarcas
 * ("Maresme") y la migración de la app vieja guardó el municipio
 * ("Mataró", "Roses", "Pals"). Resultado: 19 etiquetas distintas para 26
 * tardeos, con Mataró y Maresme como filtros separados aunque Mataró esté
 * en el Maresme. Como filtro no servía de nada.
 *
 * Agrupamos por zonas de salir, no por comarcas oficiales: al tardícola le
 * importa "Costa Daurada" más que "Baix Camp".
 */

export const ZONAS = [
  "Barcelona",
  "Maresme",
  "Costa Brava",
  "Costa Daurada",
  "Terres de l'Ebre",
  "Ponent",
] as const;

// El artículo se quita AL FINAL, cuando el apóstrofo ya es un espacio: si no,
// "L'Estartit" no coincidiría con "Estartit".
const norm = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/^(l|el|la|les|els) /, "");

// Municipio (o etiqueta suelta) -> zona grande. Lo que no esté aquí se queda
// con su propio nombre: mejor un filtro de más que meter un pueblo donde no es.
const A_ZONA: Record<string, (typeof ZONAS)[number]> = {};
const meter = (zona: (typeof ZONAS)[number], sitios: string[]) =>
  sitios.forEach((s) => (A_ZONA[norm(s)] = zona));

meter("Barcelona", [
  "Barcelona", "Barcelones", "Badalona", "Santa Coloma de Gramenet", "Sant Adria de Besos",
  "Baix Llobregat", "Hospitalet de Llobregat", "Cornella de Llobregat", "Sant Boi",
  "Sant Boi de Llobregat", "Castelldefels", "Gava", "Viladecans", "Sitges", "El Prat de Llobregat",
  "Valles Occidental", "Valles Oriental", "Sabadell", "Terrassa", "Granollers", "Mollet del Valles",
  "Santa Perpetua de Mogoda", "Cerdanyola del Valles", "Rubi", "Sant Cugat del Valles",
]);
meter("Maresme", [
  "Maresme", "Mataro", "Calella", "Pineda de Mar", "Santa Susanna", "Malgrat de Mar",
  "Arenys de Mar", "Canet de Mar", "Premia de Mar", "El Masnou", "Vilassar de Mar",
  "Cabrera de Mar", "Alella", "Canyamars", "Dosrius", "Tordera", "Sant Pol de Mar",
]);
meter("Costa Brava", [
  "Costa Brava", "Girona", "Lloret de Mar", "Blanes", "Roses", "Cadaques", "Palamos",
  "Platja d'Aro", "Sant Feliu de Guixols", "Pals", "L'Estartit", "Estartit", "Torroella de Montgri",
  "Sant Pere Pescador", "L'Escala", "Escala", "Empuriabrava", "Castello d'Empuries", "Begur",
  "Tossa de Mar", "Calella de Palafrugell", "Palafrugell",
]);
meter("Costa Daurada", [
  "Costa Daurada", "Costa Dorada", "Tarragona", "Salou", "Cambrils", "Altafulla", "Reus",
  "Vila-seca", "Torredembarra", "Calafell", "El Vendrell", "Coma-ruga", "Mont-roig del Camp",
  "L'Hospitalet de l'Infant", "Hospitalet de l'Infant", "Miami Platja", "El Tarragones",
]);
meter("Terres de l'Ebre", [
  "Terres de l'Ebre", "Amposta", "Deltebre", "Tortosa", "Sant Carles de la Rapita",
  "La Rapita", "L'Ampolla", "Ampolla", "L'Ametlla de Mar", "Alcanar", "Les Cases d'Alcanar",
]);
meter("Ponent", [
  "Ponent", "Lleida", "Castell del Remei", "Penelles", "Balaguer", "Mollerussa", "Tarrega",
  "Cervera", "La Noguera", "Pla d'Urgell", "Segria",
]);

/** Zona grande a la que pertenece una etiqueta. Si no la conocemos, se devuelve tal cual. */
export function zonaGrande(zona: string | null | undefined): string {
  if (!zona?.trim()) return "Otras";
  return A_ZONA[norm(zona)] ?? zona.trim();
}

/**
 * Zonas presentes en una lista de tardeos, con su recuento, ordenadas por
 * cuántos tardeos tienen. Las conocidas van primero; las sueltas, al final.
 */
export function zonasDe<T extends { zona: string }>(
  tardeos: T[]
): { zona: string; n: number }[] {
  const conteo = new Map<string, number>();
  for (const t of tardeos) {
    const z = zonaGrande(t.zona);
    conteo.set(z, (conteo.get(z) ?? 0) + 1);
  }
  const esConocida = (z: string) => (ZONAS as readonly string[]).includes(z);
  return [...conteo.entries()]
    .map(([zona, n]) => ({ zona, n }))
    .sort((a, b) =>
      Number(esConocida(b.zona)) - Number(esConocida(a.zona)) ||
      b.n - a.n ||
      a.zona.localeCompare(b.zona, "es")
    );
}
