"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import { degradadoDe, inicialesDe, estilosDe } from "@/components/DjCard";

type Dj = { id: string; nombre_artistico: string; estilos?: string[] | string | null; avatar_url?: string | null; verificado?: boolean };

/**
 * Carrusel de DJs de la portada: tres a la vista, el del centro grande y
 * nítido, los de los lados más pequeños, difuminados y de lado. Avanza solo
 * cada 5 s (se para al pasar el ratón, al tocar o con "reducir movimiento"),
 * con flechas, puntos, teclado y deslizar con el dedo.
 *
 * Primero van los que tienen foto: un carrusel de iniciales no luce.
 */
export default function CarruselDjs({ djs }: { djs: Dj[] }) {
  const lista = [...djs].sort((a, b) => Number(Boolean(b.avatar_url)) - Number(Boolean(a.avatar_url))).slice(0, 10);
  const n = lista.length;
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const toque = useRef<number | null>(null);

  const ir = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    if (pausa || n < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [pausa, n]);

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
      aria-label="DJs de TardeosClub"
    >
      <div className="relative mx-auto h-[440px] max-w-5xl overflow-hidden sm:h-[480px]">
        {lista.map((d, k) => {
          const r = rel(k);
          const visible = Math.abs(r) <= 1;
          const estilos = estilosDe(d.estilos).slice(0, 3);
          return (
            <div
              key={d.id}
              aria-hidden={r !== 0}
              className="absolute left-1/2 top-0 w-[78%] max-w-[340px] transition-all duration-500 ease-out sm:w-[340px]"
              style={{
                transform: `translateX(calc(-50% + ${r * 72}%)) scale(${r === 0 ? 1 : 0.8})`,
                opacity: visible ? (r === 0 ? 1 : 0.45) : 0,
                filter: r === 0 ? "none" : "blur(3px) saturate(0.8)",
                zIndex: r === 0 ? 3 : visible ? 2 : 1,
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <Link
                href={`/djs/${d.id}`}
                tabIndex={r === 0 ? 0 : -1}
                onClick={(e) => { if (r !== 0) { e.preventDefault(); ir(k); } }}
                className="group block overflow-hidden rounded-3xl bg-white shadow-elevada ring-1 ring-black/5"
              >
                <div className="relative aspect-[4/5]" style={d.avatar_url ? undefined : { background: degradadoDe(d.nombre_artistico) }}>
                  {d.avatar_url ? (
                    <Image src={d.avatar_url} alt={d.nombre_artistico} fill sizes="340px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-[72px] font-extrabold text-white/90">{inicialesDe(d.nombre_artistico)}</span>
                  )}
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="flex items-center gap-1.5 text-[24px] font-extrabold leading-tight">
                      <span className="line-clamp-1">{d.nombre_artistico}</span>
                      {d.verificado && <BadgeCheck size={20} className="shrink-0 text-oro-400" aria-label="Verificado" />}
                    </p>
                    {estilos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {estilos.map((e) => (
                          <span key={e} className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-semibold backdrop-blur">{e}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[15px] font-semibold text-tinta-suave">DJ en TardeosClub</span>
                  <span className="rounded-full bg-magenta px-3.5 py-1.5 text-[14px] font-bold text-white transition group-hover:bg-magenta-600">Ver perfil</span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-5 flex items-center justify-center gap-4">
          <button onClick={() => ir(i - 1)} aria-label="DJ anterior"
            className="grid h-12 w-12 place-items-center rounded-full border border-linea-fuerte bg-white text-tinta shadow-tarjeta transition hover:border-magenta hover:text-magenta">
            <ChevronLeft size={22} />
          </button>
          <div className="flex gap-1.5" role="tablist" aria-label="Elegir DJ">
            {lista.map((d, k) => (
              <button key={d.id} onClick={() => ir(k)} role="tab" aria-selected={k === i} aria-label={d.nombre_artistico}
                className={`h-2.5 rounded-full transition-all ${k === i ? "w-7 bg-magenta" : "w-2.5 bg-linea-fuerte hover:bg-tinta-suave"}`} />
            ))}
          </div>
          <button onClick={() => ir(i + 1)} aria-label="DJ siguiente"
            className="grid h-12 w-12 place-items-center rounded-full border border-linea-fuerte bg-white text-tinta shadow-tarjeta transition hover:border-magenta hover:text-magenta">
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
