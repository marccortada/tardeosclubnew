import TopBar from "@/components/TopBar";
import CtaLocalDj from "@/components/CtaLocalDj";
import Footer from "@/components/Footer";
import PopupCliente from "@/components/PopupCliente";
import { InicioSegunSesion } from "@/components/tardicola/InicioApp";
import DatosEstructurados from "@/components/DatosEstructurados";
import RegistrarPantalla from "@/components/RegistrarPantalla";
import { claseBoton } from "@/components/Boton";
import { getTardeosPublicados, getTardeosMasAdelante, getDjsPublicos, hoyISO } from "@/lib/tardeos";
import { flyerSrc } from "@/lib/formato";
import { FOTOS, propsFoto } from "@/lib/fotos";
import CarruselDjs from "@/components/CarruselDjs";
import Revelar from "@/components/Revelar";
import { jsonLdSitio, urlAbsoluta } from "@/lib/seo";
import type { Tardeo } from "@/lib/types";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, ArrowRight, Sun, MessageCircle, Star, Plus, ChevronDown, UserPlus } from "lucide-react";

/**
 * Portada SIN sesión: la que convierte. Casi todo el mundo llega desde el
 * móvil (un enlace en Instagram o WhatsApp), así que se diseña para 375–430
 * px y en escritorio solo tiene que verse bien.
 *
 * Objetivo: en tres segundos se entiende qué es (tardeos: fiestas de tarde en
 * la costa de Catalunya, público de 30 en adelante) y se pulsa «Ver tardeos»
 * o «Únete». Por eso el hero ocupa la pantalla con lo justo —titular, una
 * frase, dos botones y tres atajos— y debajo van bloques cortos, cada uno con
 * una sola idea:
 *
 *   hero → próximos tardeos → ¿qué te apetece? → DJs → cómo funciona →
 *   locales y DJs → preguntas → cierre
 *
 * Lo que se quitó y por qué:
 *  - El mapa del hero: cargaba Leaflet y teselas en la primera pantalla del
 *    móvil para enseñar un mapa diminuto. «Cerca de mí» lleva al mapa de
 *    verdad.
 *  - La franja oro de tres promesas: repetía lo que dicen el hero («gratis»
 *    va en el botón) y «Cómo funciona», y separaba el hero del contenido.
 *  - El muro de logos de locales: con cuatro locales y logos negros sobre
 *    negro era un bloque oscuro de una pantalla entera que no demostraba
 *    nada. Vuelve cuando haya oferta para llenarlo.
 *  - «Para ti»: sin sesión no pinta nada (la landing solo se ve sin sesión).
 *  - El botón flotante de WhatsApp y el del hero: competían con los dos
 *    botones principales y tapaban tarjetas encima de la barra de abajo. La
 *    comunidad sigue en el cierre.
 *
 * Se pinta en cada visita (no ISR): con `revalidate` la portada se congeló dos
 * veces enseñando tardeos ya pasados. La capa de datos cachea un minuto.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: urlAbsoluta("/") },
};

const WHATSAPP_COMUNIDAD = "https://chat.whatsapp.com/KMAxRPoj36w6cOSGGwnZhi?mode=ems_wa_c";

/** Crear cuenta de tardícola directamente (Acceso lee ?modo y ?rol). */
const UNETE = "/perfil?modo=signup&rol=tardicola";

export default async function Inicio() {
  const [tardeos, masAdelante, djs] = await Promise.all([
    getTardeosPublicados(),
    getTardeosMasAdelante(8),
    getDjsPublicos(),
  ]);

  // Destacados primero y por el orden del admin; luego, por fecha. Si el mes
  // viene vacío se enseñan los ya anunciados para más adelante, con su fecha.
  const ordenados = [...tardeos].sort((a, b) =>
    Number(Boolean(b.destacado)) - Number(Boolean(a.destacado))
    || (a.destacadoOrden ?? Infinity) - (b.destacadoOrden ?? Infinity)
    || a.fecha.localeCompare(b.fecha));
  // Cuatro como mucho: uno grande y tres en fila. Más convertía la portada en
  // el listado, y para eso está /eventos.
  const proximos = (ordenados.length ? ordenados : masAdelante).slice(0, 4);
  const sonDeMasAdelante = ordenados.length === 0 && masAdelante.length > 0;

  const hoy = hoyISO();
  const finde = new Set(diasDelFinde(hoy));
  const nHoy = tardeos.filter((t) => t.fecha === hoy).length;
  const nFinde = tardeos.filter((t) => finde.has(t.fecha)).length;

  // La foto del hero es lo primero que se pinta: srcset (≈750 px en un móvil,
  // no los 2340 px de antes), prioridad alta y aviso en <head> para que el
  // navegador la pida antes incluso de leer el <body>.
  const fotoHero = propsFoto(FOTOS.concierto, { sizes: "100vw", prioridad: true });
  preload(fotoHero.src, { as: "image", imageSrcSet: fotoHero.srcSet, imageSizes: fotoHero.sizes, fetchPriority: "high" });

  // Con sesión, Inicio de la app (v2); sin ella, esta landing.
  const landing = (
    <main className="bg-fondo">
      <RegistrarPantalla pantalla="home" />
      <DatosEstructurados datos={jsonLdSitio()} />
      <div className="md:hidden">
        <TopBar />
      </div>

      {/* ================= HERO =================
          La foto de concierto y el titular de siempre. Alto = la pantalla
          menos cabecera y barra de abajo (.hero-landing), contenido centrado:
          en cualquier móvil se ve entero sin hacer scroll. */}
      <section className="hero-landing relative isolate flex flex-col overflow-hidden bg-[#2a0f24] text-white">
        <div aria-hidden className="acercar absolute inset-0 -z-20">
          {/* eslint-disable-next-line @next/next/no-img-element -- srcset de Unsplash calculado con getImageProps (ver lib/fotos.ts) */}
          <img {...fotoHero} alt="" className="object-cover object-[50%_40%]" />
        </div>
        {/* Tinte rosa→naranja de la marca y sombra abajo y arriba: el texto
            blanco se lee aunque cambie la foto. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-[#D61AA8]/45 via-[#2a0f24]/25 to-[#F97316]/40" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-black/40" />

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-8 text-center md:py-16">
          <p className="entrar entrar-1 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-3.5 py-1 text-[13px] font-bold uppercase tracking-[0.08em] text-white/95 backdrop-blur-sm">
            <MapPin size={14} aria-hidden /> Costa de Catalunya · +30
          </p>
          <h1 className="entrar entrar-1 mt-4 text-[40px] leading-[1.04] tracking-[-0.03em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.35)] min-[400px]:text-[44px] md:text-[68px]">
            <span className="block font-medium">El buscador de</span>
            <span className="block text-balance font-extrabold">
              <span className="texto-oro">tardeos</span> que va contigo
            </span>
          </h1>
          <p className="entrar entrar-2 mt-3 font-script text-[25px] leading-tight text-white md:text-[32px]">
            Fiestas de tarde, sin trasnochar
          </p>

          <div className="entrar entrar-3 mt-7 grid w-full max-w-md grid-cols-2 gap-3">
            <Link href="/eventos" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-oro-400 px-3 text-[18px] font-extrabold text-sobre-oro shadow-lg transition hover:bg-oro active:scale-[0.98]">
              <CalendarDays size={20} className="hidden min-[400px]:block" aria-hidden /> Ver tardeos
            </Link>
            {/* Degradado rosa→naranja de la web de siempre. La sombra del
                texto no es adorno: sobre el extremo naranja el blanco solo no
                llega al contraste mínimo. */}
            <Link href={UNETE} className="bg-fiesta inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl px-3 text-[18px] font-extrabold text-white shadow-lg transition [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] hover:brightness-105 active:scale-[0.98]">
              <UserPlus size={20} className="hidden min-[400px]:block" aria-hidden /> Únete gratis
            </Link>
          </div>

          {/* Atajos: los tres motivos por los que se abre la web un jueves. */}
          <nav aria-label="Atajos" className="entrar entrar-4 mt-4 flex flex-wrap justify-center gap-2">
            <Atajo href="/eventos?cuando=hoy" n={nHoy}>Hoy</Atajo>
            <Atajo href="/eventos?cuando=finde" n={nFinde}>Este finde</Atajo>
            <Atajo href="/eventos?vista=mapa" icono={<MapPin size={16} aria-hidden />}>Cerca de mí</Atajo>
          </nav>
        </div>

        {/* Pista de que hay más abajo: el hero llena la pantalla y sin ella
            parecía que la web acababa ahí. */}
        {proximos.length > 0 && (
          <a href="#proximos" className="mx-auto mb-3 inline-flex min-h-[44px] items-center gap-1 px-4 text-[15px] font-semibold text-white/85 transition hover:text-white">
            {sonDeMasAdelante ? "Lo próximo" : "Próximos tardeos"} <ChevronDown size={18} aria-hidden />
          </a>
        )}
      </section>

      {/* ================= PRÓXIMOS TARDEOS =================
          Tarjetas grandes en vertical (sin carrusel): el primero en grande,
          con su cartel; los demás en fila compacta. */}
      {proximos.length > 0 && (
        <section id="proximos" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-10 md:px-8 md:pt-16">
          <Cabecera
            titulo={sonDeMasAdelante ? "Lo próximo" : "Próximos tardeos"}
            enlace={{ href: "/eventos", texto: "Ver todos" }}
          />
          {/* Con uno solo, una columna centrada: media rejilla vacía en escritorio
              parecía un fallo; el único va a lo ancho (cartel al lado). */}
          <div className={`mt-5 grid gap-4 md:gap-6 ${proximos.length > 1 ? "md:grid-cols-2" : ""}`}>
            <div className="revelar"><TardeoGrande t={proximos[0]} solo={proximos.length === 1} /></div>
            {proximos.length > 1 && (
              <ul className="revelar-hijos flex flex-col gap-3">
                {proximos.slice(1).map((t) => <li key={t.id}><TardeoFila t={t} /></li>)}
                <li className="hidden md:block">
                  <Link href="/eventos" className={claseBoton("contorno", "normal", true)}>Ver todos los tardeos <ArrowRight size={18} aria-hidden /></Link>
                </li>
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ================= ¿QUÉ TE APETECE? =================
          Por estilo de música: es como elige la gente («algo de remember»,
          «algo latino»). Cada foto abre Eventos ya buscado. */}
      <section className="mx-auto max-w-6xl px-4 pt-12 md:px-8 md:pt-16">
        <Cabecera titulo="¿Qué te apetece hoy?" />
        <div className="revelar-hijos mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {ESTILOS.map((e) => (
            <Link key={e.q} href={`/eventos?q=${encodeURIComponent(e.q)}`}
              className="group relative isolate flex aspect-[5/4] flex-col justify-end overflow-hidden rounded-2xl p-3.5 text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-lg md:aspect-[16/10] md:p-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- srcset de Unsplash calculado con getImageProps (ver lib/fotos.ts) */}
              <img {...propsFoto(e.foto, { sizes: "(min-width: 768px) 370px, 50vw" })} alt=""
                className="-z-20 object-cover transition-transform duration-500 group-hover:scale-105" />
              {/* Tinte de un color por estilo: variedad sin perder unidad, y
                  el texto blanco siempre se lee. */}
              <span aria-hidden className={`absolute inset-0 -z-10 ${e.tinte}`} />
              <span className="flex items-end justify-between gap-1">
                <span className="text-[20px] font-extrabold leading-none tracking-tight md:text-[26px]">{e.titulo}</span>
                <ArrowRight size={20} className="shrink-0 transition group-hover:translate-x-1" aria-hidden />
              </span>
              <span className="mt-1 line-clamp-1 text-[13px] font-semibold text-white/85 md:text-[14px]">{e.sub}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= DJS: el único carrusel ================= */}
      {djs.length > 0 && (
        <section className="mt-12 overflow-hidden bg-gradient-to-b from-fondo via-magenta/[0.06] to-fondo md:mt-16">
          <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
            <Cabecera titulo="Quién pone la música" enlace={{ href: "/djs", texto: "Ver DJs" }} />
            <p className="mt-1 text-[16px] text-tinta-suave">Escucha sus sesiones y mira dónde pinchan.</p>
            <div className="mt-6">
              <CarruselDjs djs={djs} />
            </div>
          </div>
        </section>
      )}

      {/* ================= CÓMO FUNCIONA =================
          Tres pasos de una línea y el botón de crear cuenta: el único bloque
          de color sólido de la página, para que se note. */}
      <section className="px-4 pt-6 md:px-8 md:pt-10">
        <div className="revelar bg-marca mx-auto max-w-6xl rounded-3xl px-5 py-8 text-white md:grid md:grid-cols-[1fr_1.3fr] md:gap-12 md:px-12 md:py-14">
          <div>
            <h2 className="text-[28px] font-extrabold leading-tight tracking-tight md:text-[40px]">Así de fácil</h2>
            <p className="mt-1 text-[16px] text-white/90">Gratis, y en un minuto tienes cuenta.</p>
            <Link href={UNETE} className={claseBoton("oro", "normal", false, "mt-6 hidden !px-7 md:inline-flex")}>Crear mi cuenta gratis</Link>
          </div>
          <ol className="mt-6 flex flex-col gap-4 md:mt-0">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="flex items-start gap-4">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-[20px] font-extrabold text-oro-400 ring-1 ring-white/25">{i + 1}</span>
                <span>
                  <span className="block text-[18px] font-bold leading-snug">{p.titulo}</span>
                  <span className="block text-[15px] leading-snug text-white/85">{p.texto}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link href={UNETE} className={claseBoton("oro", "normal", true, "mt-7 md:hidden")}>Crear mi cuenta gratis</Link>
        </div>
      </section>

      {/* ================= PARA LOCALES Y DJS ================= */}
      <CtaLocalDj />

      {/* ================= PREGUNTAS ================= */}
      <section className="mx-auto max-w-3xl px-4 pb-12 md:px-8 md:pb-16">
        <h2 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-[34px]">Preguntas rápidas</h2>
        <div className="revelar mt-5 divide-y divide-linea rounded-2xl border border-linea bg-superficie px-4 md:px-5">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="group">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                {q.p}
                <Plus size={20} className="shrink-0 text-magenta transition group-open:rotate-45" aria-hidden />
              </summary>
              <p className="pb-4 text-[16px] leading-relaxed text-tinta-suave">{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ================= CIERRE ================= */}
      <section className="px-4 pb-12 md:px-8 md:pb-16">
        <div className="revelar relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl text-center text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- srcset de Unsplash calculado con getImageProps (ver lib/fotos.ts) */}
          <img {...propsFoto(FOTOS.atardecer, { sizes: "(min-width: 1200px) 1150px, 100vw" })} alt="" className="-z-20 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-[#D61AA8]/85 via-[#7a1460]/60 to-[#F97316]/70" />
          <div className="px-5 py-12 md:py-20">
            <h2 className="text-[30px] font-extrabold leading-tight tracking-tight md:text-[48px]">¿Y dónde vamos este finde?</h2>
            <p className="mx-auto mt-2 max-w-md font-script text-[24px] leading-tight text-white md:text-[28px]">La tarde es nuestra</p>
            <div className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Link href="/eventos?cuando=finde" className={claseBoton("oro", "normal", false, "!px-8 !text-[18px]")}>
                <Sun size={20} aria-hidden /> Ver este finde
              </Link>
              <a href={WHATSAPP_COMUNIDAD} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-tacto items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/10 px-8 text-[17px] font-bold text-white backdrop-blur transition hover:bg-white/20">
                <MessageCircle size={20} aria-hidden /> Comunidad de WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <Revelar />
    </main>
  );
  return (
    <>
      <InicioSegunSesion landing={landing} tardeos={[...tardeos, ...masAdelante]} foto={fotoHero} hoy={hoy} finde={[...finde]} djs={djs} />
      <PopupCliente />
    </>
  );
}

/* ---------------------------------------------------------------------- */

/** Cabecera de bloque: título a la izquierda y, si hay, «Ver todos» a la
 *  derecha. Sin antetítulo en cursiva en cada bloque: repetido en todos
 *  cansaba y daba aire de plantilla; la Dancing Script queda para el hero y
 *  el cierre. */
function Cabecera({ titulo, enlace }: { titulo: string; enlace?: { href: string; texto: string } }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-[34px]">{titulo}</h2>
      {enlace && (
        <Link href={enlace.href} className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-[16px] font-bold text-magenta-700 transition hover:text-magenta dark:text-magenta-400">
          {enlace.texto} <ArrowRight size={17} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Atajo({ href, icono, n, children }: { href: string; icono?: ReactNode; n?: number; children: ReactNode }) {
  return (
    <Link href={href}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-4 text-[15px] font-semibold text-white backdrop-blur-md transition hover:bg-white/25 active:scale-[0.97]">
      {icono}{children}
      {!!n && <span className="ml-0.5 min-w-[22px] rounded-full bg-oro-400 px-1.5 text-center text-[13px] font-bold leading-[22px] text-sobre-oro">{n}</span>}
    </Link>
  );
}

/** El tardeo principal: cartel grande y los datos justos. Toda la tarjeta es
 *  el enlace (se acierta con el pulgar en cualquier punto). Si es el único,
 *  en escritorio va a lo ancho con el cartel a un lado: una tarjeta suelta
 *  en media pantalla parecía que faltaba algo. */
function TardeoGrande({ t, solo = false }: { t: Tardeo; solo?: boolean }) {
  const lugar = [t.local?.nombre, t.zona].filter(Boolean).join(" · ");
  const fecha = new Date(t.fecha + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return (
    <Link href={`/tardeos/${t.id}`}
      className={`group block overflow-hidden rounded-3xl border border-linea bg-superficie shadow-tarjeta transition hover:shadow-elevada ${solo ? "md:grid md:grid-cols-[minmax(0,400px)_1fr]" : ""}`}>
      <div className={`relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-magenta-400/25 via-oro/10 to-magenta-50 ${solo ? "" : "md:aspect-square"}`}>
        <Image src={flyerSrc(t)} alt={`Cartel de ${t.titulo}`} fill sizes={solo ? "(min-width: 768px) 400px, 100vw" : "(min-width: 768px) 560px, 100vw"}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        {/* bg-[#fff] y no bg-white: en modo oscuro globals.css pasa bg-white a
            superficie oscura y la fecha (texto oscuro fijo) dejaba de leerse. */}
        <span className="absolute left-3 top-3 rounded-2xl bg-[#fff] px-3 py-1.5 text-center leading-none text-[#1a1a1a] shadow-md">
          {/* Magenta oscuro fijo: la tarjeta es blanca en los dos temas y
              text-magenta pasa al neón en oscuro (poco contraste sobre blanco). */}
          <span className="block text-[13px] font-bold uppercase text-[#930E72]">{diaSemana(t.fecha)}</span>
          <span className="block text-[24px] font-extrabold">{Number(t.fecha.slice(8, 10))}</span>
          <span className="block text-[13px] font-bold uppercase">{mes(t.fecha)}</span>
        </span>
        {t.destacado && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-oro-400 px-2.5 py-1 text-[13px] font-bold text-sobre-oro">
            <Star size={13} className="fill-current" aria-hidden /> Destacado
          </span>
        )}
      </div>
      <div className={`flex items-center gap-3 p-4 md:p-5 ${solo ? "md:flex-col md:items-start md:justify-center md:gap-4 md:p-10" : ""}`}>
        <div className="min-w-0 flex-1 md:flex-none">
          {solo && <p className="hidden text-[15px] font-bold uppercase tracking-wide text-magenta-700 dark:text-magenta-400 md:block">{fecha}</p>}
          <h3 className={`line-clamp-2 text-[20px] font-extrabold leading-tight transition-colors group-hover:text-magenta ${solo ? "md:mt-2 md:text-[32px]" : ""}`}>{t.titulo}</h3>
          <p className={`mt-1 line-clamp-1 text-[15px] text-tinta-suave ${solo ? "md:mt-2 md:text-[17px]" : ""}`}>{[hora(t), lugar].filter(Boolean).join(" · ")}</p>
        </div>
        <span aria-hidden className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-magenta text-white transition group-hover:bg-magenta-600 ${solo ? "md:hidden" : ""}`}>
          <ArrowRight size={22} />
        </span>
        {solo && (
          <span aria-hidden className="hidden min-h-tacto items-center gap-2 rounded-xl bg-magenta px-6 text-[17px] font-bold text-white transition group-hover:bg-magenta-600 md:inline-flex">
            Ver tardeo <ArrowRight size={18} />
          </span>
        )}
      </div>
    </Link>
  );
}

/** El resto: fila compacta con el cartel en miniatura. */
function TardeoFila({ t }: { t: Tardeo }) {
  const lugar = [t.local?.nombre, t.zona].filter(Boolean).join(" · ");
  return (
    <Link href={`/tardeos/${t.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-linea bg-superficie p-2.5 pr-4 shadow-tarjeta transition hover:shadow-elevada">
      <span className="relative h-[104px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-magenta-400/25 to-oro/20">
        <Image src={flyerSrc(t)} alt="" fill sizes="84px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold uppercase tracking-wide text-magenta-700 dark:text-magenta-400">
          {diaSemana(t.fecha)} {Number(t.fecha.slice(8, 10))} {mes(t.fecha)}{hora(t) ? ` · ${hora(t)}` : ""}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[17px] font-bold leading-snug transition-colors group-hover:text-magenta">{t.titulo}</span>
        {lugar && <span className="mt-0.5 line-clamp-1 block text-[14px] text-tinta-suave">{lugar}</span>}
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------------- */

const ESTILOS = [
  { titulo: "Remember", sub: "80s · 90s · 2000", q: "remember", foto: FOTOS.remember, tinte: "bg-gradient-to-t from-magenta-700/90 via-magenta/40 to-transparent" },
  { titulo: "Electrónica", sub: "House · Techno", q: "house", foto: FOTOS.electronica, tinte: "bg-gradient-to-t from-black/90 via-black/40 to-transparent" },
  { titulo: "Latino", sub: "Reggaeton · Salsa", q: "latino", foto: FOTOS.latino, tinte: "bg-gradient-to-t from-[#B45309]/90 via-[#F59E0B]/35 to-transparent" },
  { titulo: "Sevillanas", sub: "Rumba · Flamenco", q: "sevillanas", foto: FOTOS.sevillanas, tinte: "bg-gradient-to-t from-[#C2410C]/90 via-naranja/35 to-transparent" },
  { titulo: "Afterwork", sub: "Al salir del trabajo", q: "afterwork", foto: FOTOS.afterwork, tinte: "bg-gradient-to-t from-[#5B21B6]/90 via-[#7C3AED]/40 to-transparent" },
  { titulo: "Vermut", sub: "Mediodía", q: "vermut", foto: FOTOS.vermut, tinte: "bg-gradient-to-t from-[#7F1D1D]/90 via-[#B91C1C]/35 to-transparent" },
];

/** Los pasos del recorrido de la v2: encontrar → Asistiré → aviso. */
const PASOS = [
  { titulo: "Encuentra tu tardeo", texto: "Por día, por zona, por música o en el mapa." },
  { titulo: "Pulsa «Asistiré»", texto: "Y lo tienes guardado en Próxima Parada." },
  { titulo: "Te avisamos", texto: "Una hora antes, para que no se te pase." },
];

const PREGUNTAS = [
  { p: "¿Qué es un tardeo?", r: "Una fiesta de tarde: suele empezar entre las 17 y las 19 h y acabar antes de medianoche. Buena música y buen ambiente, para salir sin trasnochar." },
  { p: "¿Cuesta algo?", r: "No. Buscar, guardar y apuntarte es gratis. Si un tardeo tiene entrada, se paga al local, no aquí." },
  { p: "¿Cómo me apunto?", r: "Abre el tardeo y pulsa «Asistiré». Si está lleno, entras en lista de espera y te avisamos si queda plaza." },
  { p: "¿Dónde hay tardeos?", r: "En la costa de Catalunya y alrededores: Barcelona, Maresme, Vallès, Girona y Tarragona. Cada semana se suman locales." },
  { p: "Tengo un local o pincho, ¿cómo salgo?", r: "Crea tu perfil gratis desde «¿Organizas o pinchas?». Subes el cartel, la IA rellena los datos y tu tardeo sale en la web y en el mapa." },
];

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaSemana = (iso: string) => DIAS[new Date(iso + "T12:00:00Z").getUTCDay()];
const mes = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1];
const hora = (t: Tardeo) => (t.horaInicio ? `${t.horaInicio.slice(0, 5)}${t.horaFin ? `–${t.horaFin.slice(0, 5)}` : ""}` : "");

/**
 * Los días del finde (viernes a domingo) en ISO, contando desde `hoy`. Si hoy
 * ya es viernes, sábado o domingo, solo lo que queda de él.
 */
function diasDelFinde(hoy: string): string[] {
  const [a, m, d] = hoy.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  const dow = base.getUTCDay();
  const hastaDomingo = (7 - dow) % 7;
  const desde = Math.max(0, hastaDomingo - 2);
  const dias: string[] = [];
  for (let i = desde; i <= hastaDomingo; i++) {
    const x = new Date(base); x.setUTCDate(base.getUTCDate() + i);
    dias.push(x.toISOString().slice(0, 10));
  }
  return dias;
}
