/**
 * ¿Este perfil tiene valoración que enseñar?
 *
 * Las estrellas van de 1 a 5, así que una media de 0 solo puede significar una
 * cosa: que todavía nadie ha valorado. Y enseñar "0.0" en esa situación es
 * peor que no enseñar nada — parece una nota malísima, cuando la realidad es
 * que no hay nota. Los 31 DJs de la base están hoy exactamente así.
 *
 * Vive aquí y no repetido en cada tarjeta para que el día que haya reseñas de
 * verdad no se quede alguna pantalla con la regla vieja.
 */
export function tieneValoracion(valor: unknown): boolean {
  return Number(valor ?? 0) > 0;
}

/** La media con una decimal, para cuando sí hay. */
export function valoracion(valor: unknown): string {
  return Number(valor ?? 0).toFixed(1);
}
