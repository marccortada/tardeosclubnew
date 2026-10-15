"use client";

import { useEffect } from "react";

/**
 * Activa las animaciones de aparición de la portada (.revelar y
 * .revelar-hijos en globals.css).
 *
 * Regla de oro: el contenido NUNCA depende de esto para verse. El HTML llega
 * visible; solo cuando este efecto corre se marca <html> con .con-revelar y
 * se ocultan los bloques que aún están por debajo de la pantalla, que van
 * apareciendo al llegar con el scroll. Sin JavaScript, sin
 * IntersectionObserver o con "reducir movimiento", no se oculta nada.
 *
 * Lo que ya está en pantalla al cargar se marca .visible ANTES de poner la
 * clase: si no, el bloque visible del HTML parpadeaba (visible → oculto →
 * aparece) en cuanto React tomaba el control.
 */
export default function Revelar() {
  useEffect(() => {
    const raiz = document.documentElement;
    const elementos = Array.from(document.querySelectorAll<HTMLElement>(".revelar, .revelar-hijos"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const alto = window.innerHeight;
    const pendientes = elementos.filter((e) => {
      const r = e.getBoundingClientRect();
      const yaVisto = r.top < alto && r.bottom > 0;
      if (yaVisto) e.classList.add("visible");
      return !yaVisto;
    });
    raiz.classList.add("con-revelar");

    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    pendientes.forEach((e) => obs.observe(e));

    // Al salir de la portada (o cambiar a la Inicio con sesión) se quita la
    // clase: ninguna otra pantalla debe heredar bloques ocultos.
    return () => { obs.disconnect(); raiz.classList.remove("con-revelar"); };
  }, []);
  return null;
}
