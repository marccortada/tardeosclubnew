"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Instagram, MessageCircle, Play, SlidersHorizontal, Map as MapaIcono } from "lucide-react";
import dynamic from "next/dynamic";
import TarjetaPlan from "@/components/tardicola/TarjetaPlan";
import CabeceraApp, { useZona } from "@/components/CabeceraApp";
import { useAuth } from "@/lib/useAuth";
import { getAdn, tieneAdn, type AdnTardicola } from "@/lib/tardicola";
import { encajeDe } from "@/lib/recomendar";

// El mapa (Leaflet + teselas) solo hace falta en el Inicio CON sesión. Importado
// a pelo viajaba también en la portada pública, que ya no lo enseña: ahí es
// peso muerto en el primer pantallazo del móvil.
const MapaClient = dynamic(() => import("@/components/MapaClient"), { ssr: false });
import { FAMILIAS } from "@/lib/musica";
import { mismaZona } from "@/lib/zonas";
import type { Tardeo } from "@/lib/types";

// Destinos oficiales "a comprobar" (dossier pág. 3): se cambian aquí.
const URL_INSTAGRAM = "https://www.instagram.com/tardeosclub/";
const URL_COMUNIDAD = "https://chat.whatsapp.com/KMAxRPoj36w6cOSGGwnZhi?mode=ems_wa_c";

/**
 * Con sesión, `/` es el Inicio de la app; sin sesión, la landing de siempre
 * (decisión 4 de CONTRATOS). Mientras se resuelve la sesión se enseña la
 * landing: es lo que ya venía en el HTML y no deja la pantalla en blanco.
 */
export function InicioSegunSesion({ landing, tardeos }: { landing: ReactNode; tardeos: Tardeo[] }) {
  const { user, loading } = useAuth();
  if (loading || !user) return <>{landing}</>;
  return <InicioApp tardeos={tardeos} />;
}

/** Inicio de la app, en el orden aprobado (dossier pág. 3). */
function InicioApp({ tardeos }: { tardeos: Tardeo[] }) {
  const { user } = useAuth();
  const [zona] = useZona();
  const [adn, setAdn] = useState<AdnTardicola | null>(null);
  useEffect(() => { if (user) getAdn(user.id).then(setAdn); }, [user]);

  const deZona = useMemo(() => (zona ? tardeos.filter((t) => mismaZona(t.zona, zona)) : tardeos), [tardeos, zona]);
  const destacados = deZona.filter((t) => t.destacado)
    .sort((a, b) => (a.destacadoOrden ?? Infinity) - (b.destacadoOrden ?? Infinity)).slice(0, 4);
  const afines = useMemo(() => {
    if (!tieneAdn(adn)) return [];
    return deZona.map((t) => ({ t, e: encajeDe(t, adn) })).filter((x) => x.e.motivos.length > 0)
      .sort((a, b) => b.e.puntos - a.e.puntos || a.t.fecha.localeCompare(b.t.fecha)).slice(0, 4).map((x) => x.t);
  }, [deZona, adn]);
  const chips = adn ? [
    ...[...new Set(adn.musica.map((m) => m.split(":")[0]))].map((id) => FAMILIAS.find((f) => f.id === id)?.nombre).filter(Boolean) as string[],
    ...adn.tiposEvento, ...adn.zonas,
  ].slice(0, 5) : [];
  const mapaHref = `/eventos?vista=mapa${zona ? `&zona=${encodeURIComponent(zona)}` : ""}`;

  return (
    <main className="bg-fondo">
      <CabeceraApp conZona />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-6 pt-4 md:pt-8">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-tinta">¿Dónde vamos hoy?</h1>
          <p className="text-[16px] text-tinta-suave">Encuentra tu próxima historia.</p>
        </div>

        {/* 1. Mapa pequeño: tocarlo abre Eventos en mapa con la misma zona. */}
        <section aria-label="Mapa">
          <Link href={mapaHref} aria-label="Abrir el mapa de Eventos" className="group relative block h-44 overflow-hidden rounded-3xl border border-linea">
            <div className="pointer-events-none absolute inset-0"><MapaClient tardeos={deZona} conZoom={false} /></div>
            <span className="absolute bottom-3 left-1/2 z-[500] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-superficie px-4 py-2 text-[15px] font-semibold text-tinta shadow-elevada">
              <MapaIcono size={16} className="text-magenta" aria-hidden /> Abrir mapa
            </span>
          </Link>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={URL_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-linea bg-superficie text-[15px] font-medium text-tinta">
              <Instagram size={17} aria-hidden /> Instagram
            </a>
            <a href={URL_COMUNIDAD} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-linea bg-superficie text-[15px] font-medium text-tinta">
              <MessageCircle size={17} aria-hidden /> Comunidad
            </a>
          </div>
        </section>

        {/* 2. Destacados (lo que el admin destaca es comercial: "Patrocinado"). */}
        <section>
          <Titulo href="/eventos" enlace="Ver todos">Tardeos destacados</Titulo>
          {destacados.length ? (
            <div className="grid gap-4 sm:grid-cols-2">{destacados.map((t) => <TarjetaPlan key={t.id} t={t} patrocinado afin={adn ? encajeDe(t, adn).motivos.length > 0 : false} />)}</div>
          ) : (
            <Vacio>No hay destacados {zona ? `en ${zona}` : ""} ahora mismo. <Link href="/eventos" className="font-semibold text-magenta-700">Ver todos los planes</Link></Vacio>
          )}
        </section>

        {/* 3. ADN Tardícola: lo personalizado, sin otro "Para ti" duplicado. */}
        <section>
          <Titulo href="/eventos?vista=lista" enlace="Filtros" icono={<SlidersHorizontal size={15} aria-hidden />}>ADN Tardícola</Titulo>
          {chips.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {chips.map((c) => <span key={c} className="rounded-full bg-magenta-50 px-3 py-1.5 text-[14px] font-semibold text-magenta-700">{c}</span>)}
            </div>
          )}
          {!tieneAdn(adn) ? (
            <Vacio>Cuéntanos qué te mueve y te enseñamos planes afines. <Link href="/perfil/adn" className="font-semibold text-magenta-700">Rellenar mi ADN</Link></Vacio>
          ) : afines.length ? (
            <div className="grid gap-4 sm:grid-cols-2">{afines.map((t) => <TarjetaPlan key={t.id} t={t} afin />)}</div>
          ) : (
            <Vacio>Ahora no hay planes afines {zona ? `en ${zona}` : ""}. <Link href="/eventos" className="font-semibold text-magenta-700">Ver todos</Link></Vacio>
          )}
        </section>

        {/* 4. Entre Beats (acceso profesional; la base lo protege, equipo C). */}
        <section>
          <Titulo>Entre Beats</Titulo>
          <div className="rounded-3xl border border-linea bg-superficie p-4">
            <p className="text-[17px] font-bold text-tinta">Comunidad profesional</p>
            <p className="text-[15px] text-tinta-suave">DJs, locales y organizadores</p>
            <Link href="/entre-beats" className="mt-3 flex min-h-[48px] items-center justify-center rounded-2xl border border-linea-fuerte text-[15px] font-semibold text-tinta">
              Acceso para profesionales
            </Link>
          </div>
        </section>

        {/* 5. Nexo Radio (equipo B hace el reproductor en /nexo). */}
        <section>
          <Titulo>Nexo Radio</Titulo>
          <Link href="/nexo" className="flex items-center gap-3 rounded-3xl border border-linea bg-superficie p-3">
            <Image src="/branding/nexo-radio.png" alt="" width={56} height={56} className="h-14 w-14 rounded-xl bg-black object-contain" />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold text-tinta">Nexo Radio</span>
              <span className="block text-[14px] text-tinta-suave">El ritmo de tu tarde</span>
            </span>
            <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-magenta text-magenta" aria-label="Escuchar"><Play size={20} fill="currentColor" aria-hidden /></span>
          </Link>
        </section>
      </div>
    </main>
  );
}

function Titulo({ children, href, enlace, icono }: { children: ReactNode; href?: string; enlace?: string; icono?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[22px] font-bold text-tinta">{children}</h2>
      {href && <Link href={href} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-magenta-700">{icono}{enlace}</Link>}
    </div>
  );
}
function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-3xl border border-dashed border-linea-fuerte p-4 text-[15px] text-tinta-suave">{children}</p>;
}
