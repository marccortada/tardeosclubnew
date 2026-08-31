"use client";

import { useEffect } from "react";
import { medir } from "@/lib/metricas";

/**
 * Cuenta que alguien ha abierto una de las pantallas principales.
 *
 * Distinto de RegistrarVista, que cuenta fichas concretas (este tardeo, este
 * local). Aquí no hay a qué apuntar: lo que se quiere saber es POR DÓNDE entra
 * la gente. Con solo las fichas medidas, se ve qué tardeo gusta y no se ve si
 * llegan por el mapa, por el listado o por la portada, que es lo que dice
 * dónde merece la pena invertir.
 *
 * Una vez por pestaña: quien vuelve al listado seis veces mientras cotillea no
 * son seis visitas.
 */
export default function RegistrarPantalla({
  pantalla,
}: {
  pantalla: "home" | "listado" | "mapa";
}) {
  useEffect(() => {
    medir(`vista_${pantalla}` as const, {}, { unaVezPorSesion: true });
  }, [pantalla]);

  return null;
}
