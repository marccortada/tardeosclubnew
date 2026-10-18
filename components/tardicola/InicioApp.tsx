"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode, type ImgHTMLAttributes } from "react";
import { Instagram, MessageCircle, Play, SlidersHorizontal, Map as MapaIcono, CalendarDays, MapPin, Sparkles, ChevronRight, Users } from "lucide-react";
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
import { mismaZona, zonaGrande } from "@/lib/zonas";
import { FOTOS } from "@/lib/fotos";
import type { Tardeo } from "@/lib/types";

// Destinos oficiales "a comprobar" (dossier pág. 3): se cambian aquí.
const URL_INSTAGRAM = "https://www.instagram.com/tardeosclub/";
const URL_COMUNIDAD = "https://chat.whatsapp.com/KMAxRPoj36w6cOSGGwnZhi?mode=ems_wa_c";

/**
 * Centro aproximado de cada zona, para que el mapa del Inicio enseñe la zona
 * elegida aunque tenga 0-1 planes (con 2 o más ya se encuadra a sus planes).
 * La clave va normalizada; primero el nombre tal cual (Girona ≠ Costa Brava)
 * y si no, su zona grande.
 */
const CENTROS: Record<string, [number, number]> = {
  "barcelona": [41.39, 2.17], "maresme": [41.58, 2.55], "costa brava": [41.85, 3.08],
  "girona": [41.98, 2.82], "costa daurada": [41.1, 1.15], "tarragona": [41.12, 1.25],
  "terres de l'ebre": [40.75, 0.65], "ponent": [41.62, 0.62],
};
const clave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const centroDe = (zona: string) => (zona ? CENTROS[clave(zona)] ?? CENTROS[clave(zonaGrande(zona))] : undefined);

/** Atributos de la foto del hero, ya calculados en el servidor (propsFoto). */
type FotoHero = ImgHTMLAttributes<HTMLImageElement>;

/**
 * Con sesión, `/` es el Inicio de la app; sin sesión, la landing de siempre
 * (decisión 4 de CONTRATOS). Mientras se resuelve la sesión se enseña la
 * landing: es lo que ya venía en el HTML y no deja la pantalla en blanco.
 */
export function InicioSegunSesion({ landing, tardeos, foto, hoy, finde }: {
  landing: ReactNode; tardeos: Tardeo[]; foto: FotoHero; hoy: string; finde: string[];
}) {
  const { user, loading } = useAuth();
  if (loading || !user) return <>{landing}</>;
  return <InicioApp tardeos={tardeos} foto={foto} hoy={hoy} finde={finde} />;
}

/**
 * Inicio de la app, en el orden aprobado (dossier pág. 3), con la misma cara
 * que la portada pública: arriba la foto de concierto con el titular y los
 * atajos. Antes era fondo gris + mapa + cajas vacías con borde de puntos y, con
 * pocos tardeos cargados, la primera pantalla parecía rota. Regla: nunca una
 * caja vacía; si no hay destacados se enseñan los próximos, y si no hay nada,
 * una tarjeta con foto que lleva a DJs y a Nexo.
 */
function InicioApp({ tardeos, foto, hoy, finde }: { tardeos: Tardeo[]; foto: FotoHero; hoy: string; finde: string[] }) {
  const { user } = useAuth();
  const [zona] = useZona();
  const [adn, setAdn] = useState<AdnTardicola | null>(null);
  useEffect(() => { if (user) getAdn(user.id).then(setAdn); }, [user]);

  const deZona = useMemo(() => (zona ? tardeos.filter((t) => mismaZona(t.zona, zona)) : tardeos), [tardeos, zona]);
  const destacados = deZona.filter((t) => t.destacado)
    .sort((a, b) => (a.destacadoOrden ?? Infinity) - (b.destacadoOrden ?? Infinity)).slice(0, 4);
  // Sin destacados, los próximos por fecha: la sección nunca queda vacía si hay planes.
  const planes = destacados.length ? destacados
    : [...deZona].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "")).slice(0, 4);
  const afines = useMemo(() => {
    if (!tieneAdn(adn)) return [];
    return deZona.map((t) => ({ t, e: encajeDe(t, adn) })).filter((x) => x.e.motivos.length > 0)
      .sort((a, b) => b.e.puntos - a.e.puntos || a.t.fecha.localeCompare(b.t.fecha)).slice(0, 4).map((x) => x.t);
  }, [deZona, adn]);
  const chips = adn ? [
    ...[...new Set(adn.musica.map((m) => m.split(":")[0]))].map((id) => FAMILIAS.find((f) => f.id === id)?.nombre).filter(Boolean) as string[],
    ...adn.tiposEvento, ...adn.zonas,
  ].slice(0, 5) : [];
  const nHoy = deZona.filter((t) => t.fecha === hoy).length;
  const nFinde = deZona.filter((t) => finde.includes(t.fecha)).length;
  const nombre = String(user?.user_metadata?.display_name ?? "").trim().split(/\s+/)[0];
  // Sin `&zona=`: Eventos ya toma la zona de la cabecera, y pasarla como filtro
  // de URL hacía que Eventos ignorara el ADN (lo trataba como filtros elegidos).
  const mapaHref = "/eventos?vista=mapa";

  return (
    <main className="bg-fondo">
      <CabeceraApp conZona />

      {/* HERO: la foto y los degradados de la portada pública, más bajo (aquí
          lo que importa son los planes de debajo). */}
      <section className="relative isolate overflow-hidden bg-noche text-white">
        <div aria-hidden className="acercar absolute inset-0 -z-20">
          {/* eslint-disable-next-line @next/next/no-img-element -- srcset de Unsplash calculado en el servidor (lib/fotos.ts) */}
          <img {...foto} alt="" className="object-cover object-[50%_40%]" />
        </div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-[#D61AA8]/45 via-[#2a0f24]/25 to-[#F97316]/40" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/30 to-black/45" />
        <div className="mx-auto max-w-3xl px-5 pb-6 pt-8 md:pb-10 md:pt-12">
          {nombre && <p className="entrar entrar-1 text-[16px] font-semibold text-white/90">Hola, {nombre}</p>}
          <h1 className="entrar entrar-1 mt-1 text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.35)] md:text-[52px]">
            ¿Dónde vamos <span className="texto-oro">hoy</span>?
          </h1>
          <p className="entrar entrar-2 mt-1 font-script text-[24px] leading-tight text-white md:text-[30px]">Fiestas de tarde, sin trasnochar</p>
          <Link href="/eventos" className="entrar entrar-3 mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-oro-400 px-4 text-[18px] font-extrabold text-sobre-oro shadow-lg transition hover:bg-oro active:scale-[0.98] sm:w-auto sm:px-8">
            <CalendarDays size={20} aria-hidden /> Ver tardeos
          </Link>
          <nav aria-label="Atajos" className="entrar entrar-4 mt-3 flex flex-wrap gap-2">
            <Atajo href="/eventos?cuando=hoy" n={nHoy}>Hoy</Atajo>
            <Atajo href="/eventos?cuando=finde" n={nFinde}>Este finde</Atajo>
            <Atajo href={mapaHref} icono={<MapPin size={16} aria-hidden />}>Mapa</Atajo>
          </nav>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-9 px-4 pb-8 pt-6 md:pt-8">
        {/* 1. Destacados (lo que el admin destaca es comercial: "Patrocinado") o, si no hay, los próximos. */}
        <section>
          <Titulo href="/eventos" enlace="Ver todos">{destacados.length ? "Tardeos destacados" : "Próximos tardeos"}</Titulo>
          {planes.length ? (
            <div className="grid gap-4 sm:grid-cols-2">{planes.map((t) => <TarjetaPlan key={t.id} t={t} patrocinado={!!t.destacado} afin={adn ? encajeDe(t, adn).motivos.length > 0 : false} />)}</div>
          ) : (
            <SinPlanes zona={zona} />
          )}
        </section>

        {/* 2. ADN Tardícola: lo personalizado, sin otro "Para ti" duplicado. */}
        {!tieneAdn(adn) ? (
          <Link href="/perfil/adn" className="bg-fiesta group flex items-center gap-4 rounded-3xl p-5 text-white shadow-elevada transition active:scale-[0.99]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20"><Sparkles size={24} aria-hidden /></span>
            <span className="min-w-0 flex-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]">
              <span className="block text-[19px] font-extrabold leading-tight">Tu ADN Tardícola</span>
              <span className="block text-[15px] text-white/95">Dinos qué música te mueve y te avisamos de tus planes. 1 minuto.</span>
            </span>
            <ChevronRight size={22} className="shrink-0" aria-hidden />
          </Link>
        ) : (
          <section>
            <Titulo href="/eventos?vista=lista" enlace="Filtros" icono={<SlidersHorizontal size={15} aria-hidden />}>Tu ADN Tardícola</Titulo>
            {chips.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {chips.map((c) => <span key={c} className="rounded-full bg-magenta-50 px-3 py-1.5 text-[14px] font-semibold text-magenta-700">{c}</span>)}
              </div>
            )}
            {afines.length ? (
              <div className="grid gap-4 sm:grid-cols-2">{afines.map((t) => <TarjetaPlan key={t.id} t={t} afin />)}</div>
            ) : (
              <p className="text-[15px] text-tinta-suave">Te avisaremos en cuanto haya planes a tu gusto{zona ? ` en ${zona}` : ""}.</p>
            )}
          </section>
        )}

        {/* 3. Mapa pequeño: tocarlo abre Eventos en mapa con la misma zona. */}
        <section>
          <Titulo href={mapaHref} enlace="Abrir">En el mapa</Titulo>
          <Link href={mapaHref} aria-label="Abrir el mapa de Eventos" className="group relative block h-44 overflow-hidden rounded-3xl border border-linea">
            <div className="pointer-events-none absolute inset-0"><MapaClient tardeos={deZona} conZoom={false} centro={centroDe(zona)} /></div>
            <span className="absolute bottom-3 left-1/2 z-[500] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-superficie px-4 py-2 text-[15px] font-semibold text-tinta shadow-elevada">
              <MapaIcono size={16} className="text-magenta" aria-hidden /> Abrir mapa
            </span>
          </Link>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={URL_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-linea bg-superficie text-[15px] font-semibold text-tinta">
              <Instagram size={18} className="text-magenta" aria-hidden /> Instagram
            </a>
            <a href={URL_COMUNIDAD} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-linea bg-superficie text-[15px] font-semibold text-tinta">
              <MessageCircle size={18} className="text-[#25D366]" aria-hidden /> Comunidad
            </a>
          </div>
        </section>

        {/* 4. Nexo Radio (equipo B hace el reproductor en /nexo). */}
        <Link href="/nexo" className="relative isolate flex items-center gap-4 overflow-hidden rounded-3xl bg-noche p-4 text-white shadow-elevada">
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#D61AA8]/35 to-transparent" />
          <Image src="/branding/nexo-radio.png" alt="" width={64} height={64} className="h-16 w-16 rounded-2xl bg-black object-contain" />
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-extrabold">Nexo Radio</span>
            <span className="block text-[15px] text-white/80">El ritmo de tu tarde</span>
          </span>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-oro-400 text-sobre-oro" aria-label="Escuchar"><Play size={20} fill="currentColor" aria-hidden /></span>
        </Link>

        {/* 5. Entre Beats (acceso profesional; la base lo protege, equipo C). Una fila: al tardícola le basta saber que existe. */}
        <Link href="/entre-beats" className="flex min-h-[64px] items-center gap-3 rounded-3xl border border-linea bg-superficie px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-magenta-50 text-magenta-700"><Users size={20} aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold text-tinta">Entre Beats</span>
            <span className="block text-[14px] text-tinta-suave">Comunidad de DJs, locales y organizadores</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-tinta-suave" aria-hidden />
        </Link>
      </div>
    </main>
  );
}

/** Mismo atajo que el hero de la portada pública (píldora translúcida + número en oro). */
function Atajo({ href, icono, n, children }: { href: string; icono?: ReactNode; n?: number; children: ReactNode }) {
  return (
    <Link href={href}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-4 text-[15px] font-semibold text-white backdrop-blur-md transition hover:bg-white/25 active:scale-[0.97]">
      {icono}{children}
      {!!n && <span className="ml-0.5 min-w-[22px] rounded-full bg-oro-400 px-1.5 text-center text-[13px] font-bold leading-[22px] text-sobre-oro">{n}</span>}
    </Link>
  );
}

/** Sin planes cargados: una tarjeta con foto y salida a lo que sí hay (DJs, radio), no una caja vacía. */
function SinPlanes({ zona }: { zona: string }) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-noche p-5 text-white">
      <Image src={`https://images.unsplash.com/photo-${FOTOS.atardecer}?auto=format&fit=crop&w=900&q=60`} alt="" fill unoptimized className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
      <p className="text-[20px] font-extrabold leading-tight">Nuevos tardeos en camino{zona ? ` en ${zona}` : ""}</p>
      <p className="mt-1 text-[15px] text-white/90">Los locales están subiendo sus próximas fechas. Mientras, descubre DJs o escucha la radio.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/djs" className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-oro-400 text-[16px] font-extrabold text-sobre-oro">Ver DJs</Link>
        <Link href="/nexo" className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-white/50 bg-white/15 text-[16px] font-bold text-white backdrop-blur-md">Nexo Radio</Link>
      </div>
    </div>
  );
}

function Titulo({ children, href, enlace, icono }: { children: ReactNode; href?: string; enlace?: string; icono?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[22px] font-bold text-tinta">{children}</h2>
      {href && <Link href={href} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-magenta-700 dark:text-magenta-400">{icono}{enlace}</Link>}
    </div>
  );
}
