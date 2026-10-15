"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, MapPin, ChevronDown, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { contarAvisosSinLeer, getZonas, leerZona, guardarZona, type Zona } from "@/lib/tardicola";

/**
 * Cabecera de cada pestaña de la app (vídeo 0:00): logo a la izquierda, título
 * (o selector de zona en Inicio) en el centro y campana a la derecha.
 * Solo en móvil: en escritorio manda SiteNav.
 */
export default function CabeceraApp({ titulo, conZona = false, volver }: { titulo?: string; conZona?: boolean; volver?: string }) {
  return (
    <header className="sticky top-0 z-[800] grid h-16 grid-cols-[56px_1fr_56px] items-center border-b border-linea bg-superficie/95 px-3 backdrop-blur md:hidden">
      {volver ? (
        <Link href={volver} aria-label="Volver" className="grid h-11 w-11 place-items-center rounded-full text-tinta hover:bg-marfil-100">
          <ArrowLeft size={22} aria-hidden />
        </Link>
      ) : (
        <Link href="/" aria-label="TardeosClub, inicio" className="grid h-11 w-11 place-items-center overflow-hidden rounded-full">
          <Image src="/branding/logo-transp.png" alt="TardeosClub" width={88} height={52} priority className="h-auto w-11" />
        </Link>
      )}
      <div className="flex min-w-0 justify-center">
        {conZona ? <SelectorZona /> : <h1 className="truncate text-[19px] font-bold text-tinta">{titulo}</h1>}
      </div>
      <Campana />
    </header>
  );
}

/** Campana con el número de avisos sin leer (bandeja /avisos, equipo D). */
export function Campana() {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    contarAvisosSinLeer(user.id).then((x) => vivo && setN(x));
    return () => { vivo = false; };
  }, [user]);
  return (
    <Link href={user ? "/avisos" : "/perfil?volver=/avisos"} aria-label={n ? `Avisos: ${n} sin leer` : "Avisos"}
      className="relative ml-auto grid h-11 w-11 place-items-center rounded-full text-tinta hover:bg-marfil-100">
      <Bell size={22} aria-hidden />
      {user && n > 0 && (
        <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-magenta px-1 text-[11px] font-bold leading-none text-white">
          {n > 9 ? "9+" : n}
        </span>
      )}
    </Link>
  );
}

/**
 * Zona elegida: se guarda en el navegador y es el filtro por defecto de
 * Eventos e Inicio. "" = todas.
 */
export function useZona(): [string, (z: string) => void] {
  const [zona, setZona] = useState("");
  useEffect(() => {
    setZona(leerZona());
    const oir = (e: Event) => setZona((e as CustomEvent<string>).detail ?? "");
    window.addEventListener("tc-zona", oir);
    return () => window.removeEventListener("tc-zona", oir);
  }, []);
  return [zona, (z: string) => { guardarZona(z); setZona(z); }];
}

export function SelectorZona() {
  const [zona, setZona] = useZona();
  const [zonas, setZonas] = useState<Zona[]>([]);
  useEffect(() => { getZonas().then(setZonas); }, []);
  return (
    <label className="relative inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[16px] font-semibold text-tinta hover:bg-marfil-100">
      <MapPin size={18} className="text-magenta" aria-hidden />
      <span className="max-w-[10rem] truncate">{zona || "Todas las zonas"}</span>
      <ChevronDown size={16} aria-hidden />
      <select aria-label="Zona" value={zona} onChange={(e) => setZona(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0">
        <option value="">Todas las zonas</option>
        {zonas.map((z) => <option key={z.slug} value={z.nombre}>{z.nombre}</option>)}
      </select>
    </label>
  );
}
