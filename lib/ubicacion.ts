"use client";

import { useEffect, useState } from "react";
import type { Coords } from "./geo";

const CLAVE = "ubicacion-tardeos";
const VIGENCIA_MS = 30 * 60 * 1000; // media hora

type Estado = "pidiendo" | "ok" | "denegada" | "no-soportada";

/**
 * Ubicación del visitante, sin pedirla al entrar.
 *
 * El navegador enseña el diálogo de permiso en cuanto se llama, así que esto
 * NO lo pide solo: hay que llamar a `pedir()` desde un botón. Pedirlo nada más
 * cargar es la forma más rápida de que te lo denieguen para siempre, y encima
 * asusta a quien solo venía a mirar tardeos.
 *
 * Se cachea media hora en sessionStorage: entre ir de la lista al mapa y
 * volver, no tiene sentido despertar el GPS otra vez.
 */
export function useUbicacion() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [estado, setEstado] = useState<Estado>("denegada");

  useEffect(() => {
    if (!("geolocation" in navigator)) { setEstado("no-soportada"); return; }
    try {
      const guardada = sessionStorage.getItem(CLAVE);
      if (guardada) {
        const { lat, lng, cuando } = JSON.parse(guardada);
        if (Date.now() - cuando < VIGENCIA_MS) { setCoords({ lat, lng }); setEstado("ok"); }
      }
    } catch {
      /* sessionStorage corrupto o bloqueado: se pedirá con el botón */
    }
  }, []);

  const pedir = () => {
    if (!("geolocation" in navigator)) { setEstado("no-soportada"); return; }
    setEstado("pidiendo");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c); setEstado("ok");
        try {
          sessionStorage.setItem(CLAVE, JSON.stringify({ ...c, cuando: Date.now() }));
        } catch { /* incógnito o almacenamiento lleno: funciona igual, sin recordar */ }
      },
      () => setEstado("denegada"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  };

  return { coords, estado, pedir };
}
