/**
 * Cálculos de distancia. Sin "use client" a propósito: TardeoCard los usa y esa
 * tarjeta se pinta también desde páginas de servidor (la ficha de un local).
 * Si vivieran en el módulo del hook, que sí es de cliente, llamarlas desde el
 * servidor reventaría en ejecución aunque TypeScript no dijera nada.
 */

export type Coords = { lat: number; lng: number };

/** Distancia en km entre dos puntos (Haversine). */
export function distanciaKm(a: Coords, b: Coords): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "800 m" · "1,2 km" · "14 km" — sin decimales absurdos. */
export function formatDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}
