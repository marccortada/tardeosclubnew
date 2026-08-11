"use client";

import { useEffect } from "react";

/**
 * Registra el service worker al cargar cualquier página. No pinta nada.
 *
 * Va en el layout y no dentro del botón de notificaciones porque el service
 * worker también es lo que hace instalable la PWA: sin él registrado, el móvil
 * ni siquiera ofrece "añadir a pantalla de inicio" como app.
 */
export default function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin service worker la web sigue funcionando igual; solo se pierde push/PWA */
    });
  }, []);
  return null;
}
