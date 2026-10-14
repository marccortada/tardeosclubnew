"use client";

import { useEffect } from "react";

/**
 * Activa las animaciones de aparición de la portada (.revelar y
 * .revelar-hijos en globals.css): marca <html> con .js y, con un solo
 * IntersectionObserver, añade .visible a cada bloque cuando entra en
 * pantalla. Sin JavaScript no se oculta nada; con "reducir movimiento" se
 * enseña todo directamente.
 */
export default function Revelar() {
  useEffect(() => {
    const raiz = document.documentElement;
    const elementos = Array.from(document.querySelectorAll<HTMLElement>(".revelar, .revelar-hijos"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      elementos.forEach((e) => e.classList.add("visible"));
      return;
    }
    raiz.classList.add("js");
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    elementos.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, []);
  return null;
}
