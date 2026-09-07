/**
 * El vocabulario de estados de un local, en un solo sitio.
 *
 * Un local tiene CUATRO cosas independientes, y confundirlas es el origen de
 * la mitad de los líos:
 *
 *   1. `verificado`   — si alguien de Tardeos Club ha comprobado que existe.
 *   2. `estado`       — si su ficha se ve en público.
 *   3. `plan`         — qué nivel tiene contratado.
 *   4. `plan_estado`  — si está al corriente de pago.
 *
 * Son cuatro columnas separadas a propósito: un local puede estar verificado y
 * sin publicar (recién dado de alta), publicado y sin pagar (hoy son todos), o
 * pagando y oculto (nunca debería, y de eso va `combinacionInvalida`).
 *
 * QUÉ HACE ESTE FICHERO: dar UNA sola redacción para cada estado. Antes cada
 * pantalla se inventaba la suya —«Impago» en suscripciones, «pago pendiente»
 * en el panel del local, «oculto» en colaboradores— y tres nombres para lo
 * mismo hacen creer que son tres cosas. Es lo que piden A-17 y Q-07.
 */

export type Publicacion = "borrador" | "activo" | "oculto" | "oculto_impago";
export type Suscripcion = "sin_suscripcion" | "activa" | "impago" | "cancelada";

export const PUBLICACION: { k: Publicacion; label: string; ayuda: string }[] = [
  { k: "borrador", label: "Sin publicar", ayuda: "La ficha existe pero no se ve en la web." },
  { k: "activo", label: "Publicada", ayuda: "Se ve en la web, en el mapa y en las búsquedas." },
  { k: "oculto", label: "Oculta", ayuda: "Retirada de la web por decisión de Tardeos Club." },
  { k: "oculto_impago", label: "Oculta por impago", ayuda: "Retirada de la web por no estar al corriente." },
];

export const SUSCRIPCION: { k: Suscripcion; label: string; ayuda: string }[] = [
  { k: "sin_suscripcion", label: "Sin suscripción", ayuda: "No ha contratado ningún plan." },
  { k: "activa", label: "Al corriente", ayuda: "Ha pagado y está dentro del periodo." },
  { k: "impago", label: "Pago pendiente", ayuda: "Tiene plan, pero un recibo sin pagar." },
  { k: "cancelada", label: "Cancelada", ayuda: "Se dio de baja. Conserva su plan por si vuelve." },
];

const etiqueta = <T extends string>(lista: { k: T; label: string }[], k: string | null | undefined) =>
  lista.find((x) => x.k === k)?.label ?? "—";

/** Cómo se llama en pantalla el estado de publicación. */
export const etiquetaPublicacion = (k?: string | null) => etiqueta(PUBLICACION, k);
/** Cómo se llama en pantalla el estado de la suscripción. */
export const etiquetaSuscripcion = (k?: string | null) => etiqueta(SUSCRIPCION, k);

/**
 * ¿Estas dos casillas se contradicen? Devuelve el motivo, o `null` si van bien.
 *
 * SOLO UNA combinación es imposible: «oculta por impago» mientras la
 * suscripción figura al corriente. Ahí hay que decidir a cuál de las dos
 * casillas hacer caso y no hay forma de saberlo. Pasa cuando alguien cobra un
 * recibo atrasado, actualiza el pago y se olvida de volver a publicar.
 *
 * Lo demás que parece raro NO se bloquea, porque es legítimo:
 *   · publicada y sin suscripción  -> hoy son los 66 locales;
 *   · publicada con pago pendiente -> un impago no retira la ficha solo;
 *   · verificada y sin publicar    -> se comprueba antes de sacarla;
 *   · oculta y sin suscripción     -> se retiró por otro motivo. Para eso
 *     está «oculto» a secas: antes solo existía «oculto_impago» y el botón de
 *     ocultar acusaba de no pagar a quien nunca había contratado nada.
 */
export function combinacionInvalida(
  estado?: string | null,
  planEstado?: string | null
): string | null {
  if (estado === "oculto_impago" && planEstado === "activa") {
    return "La ficha está oculta por impago pero la suscripción figura al corriente. Usa «Oculta» si la retiras por otro motivo, o marca el pago como pendiente.";
  }
  return null;
}
