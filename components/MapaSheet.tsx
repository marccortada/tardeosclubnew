"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Tardeo } from "@/lib/types";
import { flyerSrc } from "@/lib/formato";
import { precioCorto } from "@/lib/tardicola";
import { fechaCorta } from "@/components/tardicola/TarjetaPlan";

/**
 * Lo que sale al tocar una chincheta (dossier pág. 4, vídeo 0:50): tarjeta
 * pequeña sobre el mapa con foto, nombre, fecha y precio en píldora. Tocarla
 * abre la ficha; el mapa sigue a la vista para tocar otra.
 */
export default function MapaSheet({ tardeo, onClose }: { tardeo: Tardeo; onClose: () => void }) {
  const cerrarRef = useRef(onClose);
  const enlaceRef = useRef<HTMLAnchorElement>(null);
  // Foco al abrir (y al cambiar de chincheta): con teclado o lector de
  // pantalla, tocar un pin no llevaba a ningún sitio y la tarjeta pasaba
  // desapercibida. preventScroll: que el mapa no salte.
  useEffect(() => { enlaceRef.current?.focus({ preventScroll: true }); }, [tardeo.id]);
  useEffect(() => { cerrarRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrarRef.current(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  return (
    <div role="dialog" aria-label={`Tardeo: ${tardeo.titulo}`} className="absolute inset-x-3 bottom-3 z-[600]">
      <div className="relative flex items-center gap-3 rounded-2xl border border-linea bg-superficie p-2.5 pr-12 shadow-elevada">
        <Link ref={enlaceRef} href={`/tardeos/${tardeo.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-magenta">
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-marfil-100">
            <Image src={flyerSrc(tardeo)} alt="" fill sizes="64px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-bold text-tinta">{tardeo.titulo}</span>
            <span className="block truncate text-[13px] text-tinta-suave">
              {fechaCorta(tardeo.fecha, tardeo.horaInicio)} · {tardeo.zona || tardeo.local.nombre}
            </span>
            <span className="mt-1 inline-block rounded-lg bg-oro px-2 py-0.5 text-[14px] font-bold text-sobre-oro">{precioCorto(tardeo)}</span>
          </span>
        </Link>
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full text-tinta-suave hover:bg-marfil-100">
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
