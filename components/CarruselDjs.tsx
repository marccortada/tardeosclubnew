"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import { degradadoDe, inicialesDe, estilosDe } from "@/components/DjCard";
import { MARCA } from "@/lib/marca";

type Dj = { id: string; nombre_artistico: string; estilos?: string[] | string | null; avatar_url?: string | null; verificado?: boolean };

/**
 * Carrusel de DJs de la portada (el ÚNICO carrusel que quiere el cliente):
 * tres a la vista, el del centro grande y nítido, los de los lados más
 * pequeños y difuminados, asomando lo justo para invitar a deslizar.
 *
 * Avanza solo cada 5 s, pero solo mientras está en pantalla (si no, la
 * tarjeta cambiaba mientras la persona leía otra cosa) y nunca con "reducir
 * movimiento"; se para al tocarlo o al pasar el ratón. Flechas, puntos,
 * teclado y deslizar con el dedo.
 *
 * El alto lo marca el propio ancho (aspect-ratio), no una cifra fija: así no
 * sobra hueco en un móvil de 375 ni se corta en uno de 430, y no hay saltos
 * de diseño al cargar las fotos.
 *
 * Primero van los que tienen foto: un carrusel de iniciales no luce.
 */
export default function CarruselDjs({ djs }: { djs: Dj[] }) {
  const lista = [...djs].sort((a, b) => Number(Boolean(b.avatar_url)) - Number(Boolean(a.avatar_url))).slice(0, 8);
  const n = lista.length;
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [enPantalla, setEnPantalla] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const toque = useRef<number | null>(null);

  const ir = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    const el = raiz.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(([e]) => setEnPantalla(e.isIntersecting), { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (pausa || !enPantalla || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [pausa, enPantalla, n]);

  if (!n) return null;

  // Posición relativa al centro: -1 izquierda, 0 centro, 1 derecha.
  const rel = (k: number) => {
    let d = k - i;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  return (
    <div
      ref={raiz}
      className="relative"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onTouchStart={(e) => { setPausa(true); toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toque.current === null) return;
        const dx = e.changedTouches[0].clientX - toque.current;
        if (Math.abs(dx) > 40) ir(i + (dx < 0 ? 1 : -1));
        toque.current = null;
      }}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") ir(i - 1); if (e.key === "ArrowRight") ir(i + 1); }}
      role="region"
      aria-roledescription="carrusel"
      aria-label={`DJs de ${MARCA.nombre}`}
    >
      {/* Móvil: tarjeta al 60 % del ancho y 4:5 → el contenedor mide 0,8 del
          ancho (0,75 de la tarjeta + aire para la sombra). Desde sm, tarjeta fija de 300 px. */}
      <div className="relative mx-auto aspect-[5/4] max-w-5xl overflow-hidden sm:aspect-auto sm:h-[400px]">
        {lista.map((d, k) => {
          const r = rel(k);
          const visible = Math.abs(r) <= 1;
          const estilos = estilosDe(d.estilos).slice(0, 2);
          return (
            <div
              key={d.id}
              aria-hidden={r !== 0}
              className="absolute left-1/2 top-0 w-[60%] transition-all duration-500 ease-out sm:w-[300px]"
              style={{
                transform: `translateX(calc(-50% + ${r * 78}%)) scale(${r === 0 ? 1 : 0.82})`,
                opacity: visible ? (r === 0 ? 1 : 0.5) : 0,
                filter: r === 0 ? "none" : "blur(2px) saturate(0.8)",
                zIndex: r === 0 ? 3 : visible ? 2 : 1,
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <Link
                href={`/djs/${d.id}`}
                tabIndex={r === 0 ? 0 : -1}
                onClick={(e) => { if (r !== 0) { e.preventDefault(); ir(k); } }}
                className="group relative block aspect-[4/5] overflow-hidden rounded-3xl shadow-elevada ring-1 ring-black/5"
                style={d.avatar_url ? undefined : { background: degradadoDe(d.nombre_artistico) }}
              >
                {d.avatar_url ? (
                  <Image src={d.avatar_url} alt={d.nombre_artistico} fill sizes="(min-width: 640px) 300px, 60vw" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-[64px] font-extrabold text-white/90">{inicialesDe(d.nombre_artistico)}</span>
                )}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                  <p className="flex items-center gap-1.5 text-[20px] font-extrabold leading-tight sm:text-[22px]">
                    <span className="line-clamp-1">{d.nombre_artistico}</span>
                    {d.verificado && <BadgeCheck size={18} className="shrink-0 text-oro-400" aria-label="Verificado" />}
                  </p>
                  {estilos.length > 0 && (
                    <p className="mt-0.5 line-clamp-1 text-[14px] font-medium text-white/85">{estilos.join(" · ")}</p>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-5 flex items-center justify-center gap-4">
          <button type="button" onClick={() => ir(i - 1)} aria-label="DJ anterior"
            className="grid h-11 w-11 place-items-center rounded-full border border-linea-fuerte bg-superficie text-tinta transition hover:border-magenta hover:text-magenta">
            <ChevronLeft size={22} aria-hidden />
          </button>
          {/* Puntos: el punto se ve de 8 px, pero el botón que lo envuelve mide
              44 px de alto (y lo que dé de ancho) para que se acierte con el dedo. */}
          <div className="flex" role="tablist" aria-label="Elegir DJ">
            {lista.map((d, k) => (
              <button type="button" key={d.id} onClick={() => ir(k)} role="tab" aria-selected={k === i} aria-label={d.nombre_artistico}
                className="group grid h-11 min-w-[22px] place-items-center px-[3px]">
                <span aria-hidden className={`block h-2 rounded-full transition-all ${k === i ? "w-6 bg-magenta" : "w-2 bg-linea-fuerte group-hover:bg-tinta-suave"}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => ir(i + 1)} aria-label="DJ siguiente"
            className="grid h-11 w-11 place-items-center rounded-full border border-linea-fuerte bg-superficie text-tinta transition hover:border-magenta hover:text-magenta">
            <ChevronRight size={22} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
