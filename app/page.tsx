import TopBar from "@/components/TopBar";
import CtaLocalDj from "@/components/CtaLocalDj";
import Footer from "@/components/Footer";
import PopupCliente from "@/components/PopupCliente";
import { InicioSegunSesion } from "@/components/tardicola/InicioApp";
import ParaTi from "@/components/ParaTi";
import DatosEstructurados from "@/components/DatosEstructurados";
import MapaClient from "@/components/MapaClient";
import RegistrarPantalla from "@/components/RegistrarPantalla";
import { claseBoton } from "@/components/Boton";
import { getTardeosPublicados, getTardeosMasAdelante, getDjsPublicos, getLocalesDestacados, hoyISO } from "@/lib/tardeos";
import { flyerSrc } from "@/lib/formato";
import { FOTOS, foto } from "@/lib/fotos";
import CarruselDjs from "@/components/CarruselDjs";
import Revelar from "@/components/Revelar";
import { jsonLdSitio, urlAbsoluta } from "@/lib/seo";
import type { Tardeo } from "@/lib/types";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays, MapPin, ArrowRight, Sun, MessageCircle, Star, Clock, Plus, Map as MapaIcono, SlidersHorizontal, Heart, BellRing,
} from "lucide-react";

/**
 * La portada es la de tardeosclub.com —la que conoce la gente— rehecha:
 * mismo hero (foto de concierto, «El buscador de tardeos que va contigo»,
 * botones amarillo y degradado, mapa en marco de cristal, comunidad), mismas
 * tarjetas de Locales destacados y DJs populares, y apartados nuevos que
 * empujan a la acción: próximos tardeos, cómo funciona, para locales y DJs,
 * preguntas frecuentes y un cierre.
 *
 * Todo en rejilla centrada, sin carruseles: en la web vieja las filas se
 * cortaban por los lados y no se sabía cuántas había.
 *
 * Se pinta en cada visita (no ISR): con `revalidate` la portada se congeló dos
 * veces enseñando tardeos ya pasados. La capa de datos cachea un minuto.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: urlAbsoluta("/") },
};

// La foto del hero de la web de siempre (Unsplash, licencia libre).
const FOTO_HERO =
  "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80";

const WHATSAPP_COMUNIDAD = "https://chat.whatsapp.com/KMAxRPoj36w6cOSGGwnZhi?mode=ems_wa_c";

export default async function Inicio() {
  const [tardeos, masAdelante, djs, localesTop] = await Promise.all([
    getTardeosPublicados(),
    getTardeosMasAdelante(8),
    getDjsPublicos(),
    getLocalesDestacados(),
  ]);

  // Destacados primero y por el orden del admin; luego, por fecha. Si el mes
  // viene vacío se enseñan los ya anunciados para más adelante, con su fecha.
  const ordenados = [...tardeos].sort((a, b) =>
    Number(Boolean(b.destacado)) - Number(Boolean(a.destacado))
    || (a.destacadoOrden ?? Infinity) - (b.destacadoOrden ?? Infinity)
    || a.fecha.localeCompare(b.fecha));
  const proximos = (ordenados.length ? ordenados : masAdelante).slice(0, 8);
  const sonDeMasAdelante = ordenados.length === 0 && masAdelante.length > 0;

  const hoy = hoyISO();
  const finde = new Set(diasDelFinde(hoy));
  const nHoy = tardeos.filter((t) => t.fecha === hoy).length;
  const nFinde = tardeos.filter((t) => finde.has(t.fecha)).length;
  const paraTi = tardeos.filter((t) => !proximos.some((p) => p.id === t.id));

  // Con sesión, Inicio de la app (v2); sin ella, esta landing.
  const landing = (
    <main className="bg-white">
      <RegistrarPantalla pantalla="home" />
      <DatosEstructurados datos={jsonLdSitio()} />
      <div className="md:hidden">
        <TopBar />
      </div>

      {/* ================= HERO (el de siempre) ================= */}
      <section className="relative flex items-center justify-center overflow-hidden md:min-h-[min(calc(100vh-64px),860px)]">
        <div aria-hidden className="acercar absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url("${FOTO_HERO}")` }} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-orange-500/40 via-pink-500/30 to-purple-600/40" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-12 text-center text-white md:pb-16 md:pt-20">
          <h1 className="entrar entrar-1 font-display leading-[1.05] drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
            <span className="block text-[38px] font-normal sm:text-[52px] md:text-[64px]">El buscador de</span>
            <span className="block text-[38px] font-bold sm:text-[52px] md:text-[64px]">
              <span className="texto-oro">tardeos</span> que va contigo
            </span>
          </h1>
          <p className="entrar entrar-2 mt-3 font-script text-[22px] text-white/95 md:text-[28px]">
            Rápido, con flow y hecho para ti. Solo en TardeosClub
          </p>

          <div className="entrar entrar-3 mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/tardeos" className={claseBoton("oro", "normal", false, "w-full !rounded-xl !px-8 !text-[18px] shadow-lg sm:w-auto")}>
              <CalendarDays size={20} aria-hidden /> Ver tardeos
            </Link>
            <Link href="/tardeos?filtros=1" className={claseBoton("fiesta", "normal", false, "w-full !rounded-xl !px-8 !text-[18px] shadow-lg sm:w-auto")}>
              <SlidersHorizontal size={20} aria-hidden /> Filtrar tardeos
            </Link>
          </div>

          {/* Accesos rápidos: lo nuevo respecto a la web de siempre. */}
          <div className="entrar entrar-3 mt-5 flex flex-wrap justify-center gap-2">
            <Chip href="/tardeos?cuando=hoy" icono={<CalendarDays size={16} aria-hidden />} n={nHoy}>Hoy</Chip>
            <Chip href="/tardeos?cuando=finde" icono={<Sun size={16} aria-hidden />} n={nFinde}>Este finde</Chip>
            <Chip href="/mapa" icono={<MapPin size={16} aria-hidden />}>Cerca de mí</Chip>
          </div>

          {/* El mapa en su marco de cristal, como en la web de siempre. */}
          <div className="entrar entrar-4 mx-auto mt-8 max-w-2xl md:mt-12">
            <Link href="/mapa" aria-label="Abrir el mapa de tardeos"
              className="group block rounded-2xl border border-white/20 bg-white/10 p-1.5 shadow-xl backdrop-blur-sm transition duration-500 hover:shadow-2xl sm:p-4">
              <div className="relative h-48 overflow-hidden rounded-xl bg-marfil-100 md:h-64">
                <div className="pointer-events-none absolute inset-0">
                  <MapaClient tardeos={[...tardeos, ...masAdelante]} conZoom={false} />
                </div>
                <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-tinta shadow-lg transition group-hover:scale-105">
                  <MapaIcono size={17} className="text-magenta" aria-hidden /> Abrir mapa completo
                </span>
              </div>
            </Link>
          </div>

          <a href={WHATSAPP_COMUNIDAD} target="_blank" rel="noopener noreferrer"
            className="latido mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#22C55E] px-6 text-[16px] font-semibold text-white shadow-lg transition hover:bg-[#16A34A]">
            <MessageCircle size={20} aria-hidden /> Únete a la comunidad
          </a>
        </div>
      </section>

      {/* ================= FRANJA DE VALOR =================
          Tres promesas que se pueden cumplir, en bloque oro y letra grande:
          lo primero que se lee al bajar del hero. */}
      <section className="bg-oro-400 text-tinta">
        <ul className="mx-auto grid max-w-6xl gap-x-8 gap-y-3 px-4 py-6 text-[17px] font-bold md:grid-cols-3 md:px-8 md:py-7 md:text-[19px]">
          {[
            { icono: <CalendarDays size={22} aria-hidden />, t: "Todos los tardeos de la costa, en un sitio" },
            { icono: <Heart size={22} aria-hidden />, t: "Gratis: busca, guarda y apúntate" },
            { icono: <BellRing size={22} aria-hidden />, t: "Te avisamos cuando sale uno cerca" },
          ].map((x) => (
            <li key={x.t} className="flex items-center gap-3">{x.icono}{x.t}</li>
          ))}
        </ul>
      </section>

      {/* ================= ¿QUÉ TE APETECE? =================
          Bloques de color por estilo de música: es como elige la gente
          ("algo de remember", "algo latino"). Cada uno abre el listado ya
          buscado. Colores de la marca, sin fotos de banco. */}
      <section className="mx-auto max-w-6xl px-4 pt-12 md:px-8 md:pt-16">
        <p className="font-script text-[24px] text-magenta">Elige tu rollo</p>
        <h2 className="text-[30px] font-extrabold leading-tight tracking-tight md:text-[40px]">¿Qué te apetece esta tarde?</h2>
        <div className="revelar-hijos mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {ESTILOS.map((e) => (
            <Link key={e.q} href={`/tardeos?q=${encodeURIComponent(e.q)}`}
              className="group relative isolate flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl p-4 text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-lg md:min-h-[210px] md:p-5">
              <Image src={foto(e.foto, 700)} alt="" fill unoptimized sizes="(max-width: 768px) 50vw, 380px"
                className="-z-20 object-cover transition-transform duration-500 group-hover:scale-105" />
              {/* Tinte del color de la marca sobre la foto: da variedad sin
                  perder unidad, y garantiza que el texto blanco se lea. */}
              <span aria-hidden className={`absolute inset-0 -z-10 ${e.tinte}`} />
              <span className="text-[13px] font-semibold uppercase tracking-wider text-white/85">{e.sub}</span>
              <span className="flex items-end justify-between gap-2">
                <span className="text-[24px] font-extrabold leading-none tracking-tight md:text-[30px]">{e.titulo}</span>
                <ArrowRight size={24} className="shrink-0 transition group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= PRÓXIMOS TARDEOS (nuevo) ================= */}
      {proximos.length > 0 && (
        <Seccion
          icono={<CalendarDays size={26} aria-hidden />}
          titulo={sonDeMasAdelante ? "Próximamente" : "Próximos tardeos"}
          subtitulo={sonDeMasAdelante ? "Ya anunciados para las próximas semanas" : "Los planes de tarde que vienen, con su cartel"}
          enlace={{ href: "/tardeos", texto: "Ver todos los tardeos" }}
        >
          {proximos.length >= 4 ? (
            <div className="revelar-hijos grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {filasCompletas(proximos, 8).map((t) => <TarjetaTardeo key={t.id} t={t} />)}
            </div>
          ) : (
            // Con pocos, en grande: una tarjeta suelta en una rejilla de cuatro
            // parecía que faltaba contenido.
            <div className={`revelar-hijos grid gap-5 ${proximos.length > 1 ? "lg:grid-cols-2" : "mx-auto max-w-3xl"}`}>
              {proximos.map((t) => <TarjetaTardeoAncha key={t.id} t={t} />)}
            </div>
          )}
        </Seccion>
      )}

      {/* Solo si la persona ha dicho qué le gusta y hay algo que encaje. */}
      <ParaTi tardeos={paraTi} />

      {/* ================= LOCALES =================
          Sección negra con su muro de logos: casi todos los logos son
          blancos o de fondo oscuro y aquí lucen. Es la prueba de que los
          locales ya están dentro, que es lo que da confianza. */}
      {localesTop.locales.length > 0 && (
        <section className="mt-12 bg-[#120810] text-white md:mt-16">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-script text-[24px] text-oro-400">Donde se vive el tardeo</p>
                <h2 className="text-[30px] font-extrabold leading-tight tracking-tight md:text-[40px]">
                  {localesTop.sonDePago ? "Locales destacados" : "Locales con tardeos"}
                </h2>
                <p className="mt-2 max-w-xl text-[16px] text-white/75">Salas, terrazas, chiringuitos y promotores de toda la costa.</p>
              </div>
              <Link href="/colaboradores" className={claseBoton("oro", "normal", false, "self-start md:self-auto")}>
                Ver todos los locales <ArrowRight size={18} aria-hidden />
              </Link>
            </div>
            <ul className="revelar-hijos mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {filasCompletas(localesTop.locales, 8).map((l) => (
                <li key={l.id}><TarjetaLocal l={l} /></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ================= DJS: carrusel de tres ================= */}
      {djs.length > 0 && (
        <section className="overflow-hidden bg-gradient-to-b from-white via-magenta-50/60 to-white">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
            <div className="text-center">
              <p className="font-script text-[24px] text-magenta">Quién pone la música</p>
              <h2 className="text-[30px] font-extrabold leading-tight tracking-tight md:text-[40px]">Los DJs de los tardeos</h2>
              <p className="mx-auto mt-2 max-w-xl text-[16px] text-tinta-suave">Escucha sus sesiones, mira dónde pinchan y síguelos.</p>
            </div>
            <div className="mt-9">
              <CarruselDjs djs={djs} />
            </div>
            <div className="mt-6 text-center">
              <Link href="/colaboradores?ver=djs" className={claseBoton("contorno", "normal", false, "!px-7")}>
                Ver todos los DJs <ArrowRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ================= CÓMO FUNCIONA (nuevo) ================= */}
      <section className="px-4 md:px-8">
        <div className="revelar mx-auto max-w-6xl overflow-hidden rounded-3xl bg-magenta text-white">
          <div className="grid gap-10 px-6 py-12 md:grid-cols-[1fr_1.4fr] md:px-12 md:py-16">
            <div>
              <p className="font-script text-[26px] text-oro-400">Así de fácil</p>
              <h2 className="text-[32px] font-extrabold leading-[1.05] tracking-tight md:text-[46px]">Tu plan de tarde, en tres pasos</h2>
              <p className="mt-4 max-w-sm text-[17px] text-white/85">Crea tu cuenta en un minuto y no te pierdas ninguno.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
                <Link href="/perfil?rol=tardicola" className={claseBoton("oro", "normal", false, "whitespace-nowrap !px-7 !text-[18px]")}>Crear mi cuenta gratis</Link>
                <Link href="/tardeos" className="inline-flex min-h-tacto items-center justify-center whitespace-nowrap rounded-xl border border-white/50 px-7 text-[17px] font-bold text-white transition hover:bg-white/10">Primero quiero mirar</Link>
              </div>
            </div>
            <ol className="revelar-hijos flex flex-col divide-y divide-white/20">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="flex gap-5 py-5 first:pt-0 last:pb-0">
                  <span className="text-[48px] font-extrabold leading-none text-oro-400 md:text-[56px]">{i + 1}</span>
                  <span>
                    <span className="block text-[20px] font-bold">{p.titulo}</span>
                    <span className="mt-1 block text-[16px] leading-relaxed text-white/85">{p.texto}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className="h-6 md:h-10" aria-hidden />

      {/* ================= PARA LOCALES Y DJS (nuevo) ================= */}
      <CtaLocalDj />

      {/* ================= PREGUNTAS (nuevo) ================= */}
      <section className="mx-auto max-w-3xl px-4 py-14 md:px-8 md:py-20">
        <h2 className="text-center font-display text-[32px] font-bold leading-tight md:text-[40px]">Preguntas frecuentes</h2>
        <div className="revelar mt-8 divide-y divide-linea rounded-2xl border border-linea bg-white px-5">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="group py-4">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
                {q.p}
                <Plus size={20} className="shrink-0 text-magenta transition group-open:rotate-45" aria-hidden />
              </summary>
              <p className="mt-2 text-[16px] leading-relaxed text-tinta-suave">{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ================= CIERRE (nuevo) ================= */}
      <section className="px-4 pb-14 md:px-8 md:pb-20">
        <div className="revelar relative mx-auto max-w-6xl overflow-hidden rounded-3xl text-center text-white">
          <Image src={foto(FOTOS.atardecer, 1600)} alt="" fill unoptimized sizes="(max-width: 1200px) 100vw, 1150px" className="object-cover" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-pink-600/80 via-fuchsia-700/55 to-orange-500/60" />
          <div className="relative px-6 py-14 md:py-20">
            <h2 className="font-display text-[34px] font-bold leading-tight md:text-[52px]">¿Y dónde vamos este finde?</h2>
            <p className="mx-auto mt-3 max-w-xl text-[17px] text-white/95 md:text-[19px]">Mira lo que hay, guárdalo y queda con los tuyos.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/tardeos?cuando=finde" className={claseBoton("oro", "normal", false, "!px-8 !text-[18px]")}>
                <Sun size={20} aria-hidden /> Ver este finde
              </Link>
              <a href={WHATSAPP_COMUNIDAD} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-tacto items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/10 px-8 text-[17px] font-bold text-white backdrop-blur transition hover:bg-white/20">
                <MessageCircle size={20} aria-hidden /> Unirme al WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Botón flotante de WhatsApp, como en la web de siempre. En móvil va
          por encima de la barra de abajo. */}
      <a href={WHATSAPP_COMUNIDAD} target="_blank" rel="noopener noreferrer" aria-label="Comunidad de WhatsApp"
        className="fixed bottom-24 right-4 z-[900] grid h-14 w-14 place-items-center rounded-full bg-[#22C55E] text-white shadow-xl transition hover:scale-105 md:bottom-6 md:right-6">
        <MessageCircle size={26} aria-hidden />
      </a>

      <Revelar />
    </main>
  );
  return (
    <>
      <InicioSegunSesion landing={landing} tardeos={[...tardeos, ...masAdelante]} />
      <PopupCliente />
    </>
  );
}

/* ---------------------------------------------------------------------- */

/** Cabecera de sección como la de la web de siempre: icono + título a la
 *  izquierda, botón "Ver todos" con borde a la derecha. */
function Seccion({
  icono, titulo, subtitulo, enlace, children, fondo = false,
}: {
  icono: ReactNode; titulo: string; subtitulo: string; enlace: { href: string; texto: string }; children: ReactNode; fondo?: boolean;
}) {
  return (
    <section className={fondo ? "bg-gradient-to-b from-magenta-50/60 to-white" : ""}>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <div className="revelar mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-3 text-[26px] font-bold tracking-tight md:text-[30px]">
              <span className="text-magenta">{icono}</span>{titulo}
            </h2>
            <p className="mt-1 text-[16px] text-tinta-suave">{subtitulo}</p>
          </div>
          <Link href={enlace.href}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 self-start rounded-[14px] border border-linea-fuerte bg-white px-4 text-[15px] font-medium transition hover:border-magenta hover:text-magenta-700 sm:self-auto">
            {enlace.texto} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        {children}
      </div>
    </section>
  );
}

function Chip({ href, icono, n, children }: { href: string; icono: ReactNode; n?: number; children: ReactNode }) {
  return (
    <Link href={href}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/35 bg-white/15 px-4 text-[15px] font-semibold text-white backdrop-blur transition hover:bg-white/25">
      {icono} {children}
      {!!n && <span className="rounded-full bg-oro px-2 text-[13px] font-bold text-tinta">{n}</span>}
    </Link>
  );
}

/** Tarjeta de tardeo en el estilo de las de locales: cartel arriba, datos y
 *  botón rosa abajo. */
function TarjetaTardeo({ t }: { t: Tardeo }) {
  const lugar = [t.local?.nombre, t.zona].filter(Boolean).join(" · ");
  return (
    <Link href={`/tardeos/${t.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#E0E0E0] bg-white shadow-sm transition-all duration-300 hover:shadow-lg">
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-magenta-400/20 via-oro/10 to-magenta-50">
        <Image src={flyerSrc(t)} alt={t.titulo} fill sizes="(max-width: 1024px) 50vw, 270px"
          className="object-cover transition-transform duration-300 group-hover:scale-105" />
        <span className="absolute left-2.5 top-2.5 rounded-xl bg-white px-2.5 py-1 text-center leading-none text-tinta shadow-md">
          <span className="block text-[11px] font-bold uppercase text-magenta">{diaSemana(t.fecha)}</span>
          <span className="block text-[20px] font-bold">{Number(t.fecha.slice(8, 10))}</span>
          <span className="block text-[11px] font-bold uppercase">{mes(t.fecha)}</span>
        </span>
        {t.destacado && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-oro px-2.5 py-0.5 text-[12px] font-semibold text-tinta">
            <Star size={12} className="fill-current" aria-hidden /> Destacado
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-[16px] font-bold leading-snug transition-colors group-hover:text-magenta sm:text-[17px]">{t.titulo}</h3>
        {lugar && (
          <p className="flex items-center gap-1.5 text-[14px] text-tinta-suave">
            <MapPin size={15} className="shrink-0" aria-hidden /><span className="line-clamp-1">{lugar}</span>
          </p>
        )}
        {t.horaInicio && (
          <p className="flex items-center gap-1.5 text-[14px] text-tinta-suave">
            <Clock size={15} className="shrink-0" aria-hidden />{t.horaInicio.slice(0, 5)}{t.horaFin ? `–${t.horaFin.slice(0, 5)}` : ""}
          </p>
        )}
        <span className="mt-auto pt-2">
          <span className="flex min-h-[40px] items-center justify-center rounded-[14px] bg-magenta text-[15px] font-semibold text-white transition group-hover:bg-magenta-600">
            Ver tardeo
          </span>
        </span>
      </div>
    </Link>
  );
}

/** Recorta a filas completas de 4 (si hay al menos 4): una fila a medias
 *  deja un hueco que parece un error. */
function filasCompletas<T>(lista: T[], max: number): T[] {
  const n = Math.min(lista.length, max);
  return lista.slice(0, n >= 4 ? n - (n % 4) : n);
}

/** Tarjeta horizontal para cuando hay pocos tardeos: cartel y datos al lado. */
function TarjetaTardeoAncha({ t }: { t: Tardeo }) {
  const lugar = [t.local?.nombre, t.zona].filter(Boolean).join(" · ");
  const fecha = new Date(t.fecha + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return (
    <Link href={`/tardeos/${t.id}`}
      className="group grid overflow-hidden rounded-2xl border border-[#E0E0E0] bg-white shadow-sm transition-all duration-300 hover:shadow-lg sm:grid-cols-[220px_1fr]">
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-magenta-400/20 via-oro/10 to-magenta-50 sm:aspect-auto sm:min-h-[275px]">
        <Image src={flyerSrc(t)} alt={t.titulo} fill sizes="(max-width: 640px) 100vw, 220px"
          className="object-cover transition-transform duration-300 group-hover:scale-105" />
      </div>
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <p className="text-[14px] font-bold uppercase tracking-wide text-magenta">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
        <h3 className="text-[22px] font-bold leading-tight transition-colors group-hover:text-magenta">{t.titulo}</h3>
        <div className="flex flex-col gap-1.5 text-[15px] text-tinta-suave">
          {lugar && <p className="flex items-center gap-2"><MapPin size={17} className="shrink-0 text-magenta" aria-hidden />{lugar}</p>}
          {t.horaInicio && (
            <p className="flex items-center gap-2"><Clock size={17} className="shrink-0 text-magenta" aria-hidden />
              {t.horaInicio.slice(0, 5)}{t.horaFin ? ` – ${t.horaFin.slice(0, 5)}` : ""}</p>
          )}
        </div>
        <span className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] bg-magenta px-6 text-[16px] font-semibold text-white transition group-hover:bg-magenta-600 sm:self-start">
          Ver tardeo <ArrowRight size={18} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/** Tarjeta de local para el muro oscuro: logo grande, nombre y zona. Sin
 *  botón repetido: la tarjeta entera es el enlace. */
function TarjetaLocal({ l }: { l: { id: string; nombre: string; zona?: string | null; logo_url?: string | null; tipo?: string | null } }) {
  return (
    <Link href={`/locales/${l.id}`}
      className="group block overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10 transition duration-200 hover:bg-white/[0.1] hover:ring-oro-400/60">
      <div className="relative grid aspect-square place-items-center overflow-hidden bg-black">
        {l.logo_url ? (
          <Image src={l.logo_url} alt={l.nombre} fill sizes="(max-width: 1024px) 50vw, 270px"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="text-[44px] font-extrabold text-white/80">{iniciales(l.nombre)}</span>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="line-clamp-1 text-[16px] font-bold sm:text-[17px]">{l.nombre}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-white/65">
          <MapPin size={14} className="shrink-0" aria-hidden />
          <span className="line-clamp-1">{[l.zona, l.tipo === "promotor" ? "Eventos" : null].filter(Boolean).join(" · ") || "Costa de Catalunya"}</span>
        </p>
      </div>
    </Link>
  );
}

/* ---------------------------------------------------------------------- */

const ESTILOS = [
  { titulo: "Remember", sub: "80s · 90s · 2000", q: "remember", foto: FOTOS.remember, tinte: "bg-gradient-to-t from-magenta-700/90 via-magenta/50 to-magenta/20" },
  { titulo: "Electrónica", sub: "House · Techno", q: "house", foto: FOTOS.electronica, tinte: "bg-gradient-to-t from-black/90 via-black/45 to-black/10" },
  { titulo: "Latino", sub: "Reggaeton · Salsa", q: "latino", foto: FOTOS.latino, tinte: "bg-gradient-to-t from-[#B45309]/90 via-[#F59E0B]/40 to-transparent" },
  { titulo: "Sevillanas", sub: "Rumba · Flamenco", q: "sevillanas", foto: FOTOS.sevillanas, tinte: "bg-gradient-to-t from-[#C2410C]/90 via-naranja/40 to-transparent" },
  { titulo: "Afterwork", sub: "Al salir del trabajo", q: "afterwork", foto: FOTOS.afterwork, tinte: "bg-gradient-to-t from-[#5B21B6]/90 via-[#7C3AED]/45 to-transparent" },
  { titulo: "Vermut", sub: "Mediodía y sobremesa", q: "vermut", foto: FOTOS.vermut, tinte: "bg-gradient-to-t from-[#7F1D1D]/90 via-[#B91C1C]/35 to-transparent" },
];

const PASOS = [
  { titulo: "Encuentra tu tardeo", texto: "Por día, por zona o en el mapa. Con el cartel, la hora, el precio y quién pincha." },
  { titulo: "Guárdalo o apúntate", texto: "Dale al corazón para tenerlo en Mis planes, compra la entrada o apúntate a la lista." },
  { titulo: "Te lo recordamos", texto: "Si te apuntas, te mandamos un recordatorio el día antes. Tú solo tienes que ir." },
];

const PREGUNTAS = [
  { p: "¿Qué es un tardeo?", r: "Una fiesta de tarde: suele empezar entre las 17 y las 19 h y acabar antes de medianoche. Música, terraza o sala y buen ambiente, para salir sin trasnochar." },
  { p: "¿Cuesta algo usar TardeosClub?", r: "No. Buscar, guardar planes y recibir avisos es gratis. Si un tardeo tiene entrada, la pagas al local o en su web de entradas, no aquí." },
  { p: "¿Cómo me apunto a un tardeo?", r: "En la ficha de cada tardeo verás el botón: comprar entrada, apuntarte a la lista o apuntarte gratis, según lo que ofrezca el local." },
  { p: "¿En qué zonas hay tardeos?", r: "Sobre todo en la costa de Catalunya: Maresme, Barcelona y alrededores, el Vallès, Girona y Tarragona. Y se van sumando locales nuevos." },
  { p: "Tengo un local o pincho, ¿cómo salgo aquí?", r: "Crea tu perfil de local o de DJ gratis. Subes el cartel, la IA rellena los datos y tu tardeo sale en el listado, el mapa y los avisos." },
];

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaSemana = (iso: string) => DIAS[new Date(iso + "T12:00:00Z").getUTCDay()];
const mes = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1];

/** Iniciales con letras de verdad: un emoji al principio del nombre
 *  ("🌅🎧 TardeosClub") partía el carácter por la mitad. */
function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).map((p) => p.match(/\p{L}/u)?.[0]).filter(Boolean) as string[];
  return palabras.slice(0, 2).join("").toUpperCase() || "TC";
}

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
