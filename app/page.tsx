import Image from "next/image";
import TopBar from "@/components/TopBar";
import CarruselTardeos from "@/components/CarruselTardeos";
import ZonasRapidas from "@/components/ZonasRapidas";
import DjsDestacados from "@/components/DjsDestacados";
import LocalesDestacados from "@/components/LocalesDestacados";
import NexoRadio from "@/components/NexoRadio";
import CtaLocalDj from "@/components/CtaLocalDj";
import Footer from "@/components/Footer";
import PopupCliente from "@/components/PopupCliente";
import { getTardeosPublicados, getDjsPublicos, getLocalesDestacados } from "@/lib/tardeos";
import ParaTi from "@/components/ParaTi";
import DatosEstructurados from "@/components/DatosEstructurados";
import { jsonLdSitio, urlAbsoluta } from "@/lib/seo";
import { zonasDe } from "@/lib/zonas";
import type { Metadata } from "next";
import { CalendarDays, SlidersHorizontal, MapPin, ArrowRight, Sparkles, Sun, MessageCircle } from "lucide-react";
import Link from "next/link";
import MapaClient from "@/components/MapaClient";

// Con force-dynamic el servidor esperaba a Supabase en CADA visita. Ahora el
// HTML se reaprovecha un minuto: el mismo margen que la caché de cliente de
// lib/tardeos, así que un tardeo recién publicado tarda como mucho eso en
// asomar. Al publicar se invalida la caché de cliente, que es lo que ve el
// local al terminar.
export const revalidate = 60;

// El título y la descripción los pone el layout; aquí solo falta decirle a
// Google cuál es la dirección buena de la portada.
export const metadata: Metadata = {
  alternates: { canonical: urlAbsoluta("/") },
};

export default async function Inicio() {
  const [tardeos, djs, localesTop] = await Promise.all([
    getTardeosPublicados(),
    getDjsPublicos(),
    getLocalesDestacados(),
  ]);
  /**
   * El primer carrusel enseña los destacados de pago si los hay y, si no, los
   * próximos por fecha. Antes desaparecía cuando no había ninguno destacado, y
   * la portada se quedaba vacía teniendo 27 tardeos que enseñar.
   *
   * El título cambia con el contenido: llamar "Destacados" a los que salen
   * solo por ser los siguientes sería vender algo que nadie ha pagado.
   */
  const marcados = tardeos.filter((t) => t.destacado);
  const hayDestacados = marcados.length > 0;
  const destacados = hayDestacados ? marcados : tardeos.slice(0, 10);

  // "Este finde": viernes, sábado y domingo de la semana en curso (dinámico)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const finde = new Set<string>();
  for (let i = 0; i <= 7; i++) {
    const d = new Date(hoy); d.setDate(hoy.getDate() + i);
    const dow = d.getDay(); // 5 vie, 6 sáb, 0 dom
    if (dow === 5 || dow === 6 || dow === 0) finde.add(d.toISOString().slice(0, 10));
  }
  const esteFinde = tardeos.filter((t) => finde.has(t.fecha));

  const zonas = zonasDe(tardeos);

  return (
    <main>
      <DatosEstructurados datos={jsonLdSitio()} />
      <div className="md:hidden">
        <TopBar />
      </div>

      {/* HERO inmersivo */}
      <section className="hero-fiesta rounded-b-[2.5rem] px-6 pb-8 pt-10 text-white md:rounded-b-[3rem] md:px-10 md:pb-14 md:pt-16">
        {/* Foto de ambiente de fondo */}
        {/* Es lo primero que se ve al entrar: priority para que no aparezca
            un hueco oscuro mientras baja. */}
        <Image src="/img/hero.jpg" alt="" aria-hidden="true" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a0616]/90 via-[#58072f]/75 to-[#8a0d49]/60" />
        <span className="bokeh" style={{ width: 90, height: 90, top: 20, left: 24, background: "#ff3c82" }} />
        <span className="bokeh" style={{ width: 60, height: 60, top: 70, right: 40, background: "#f5b301" }} />
        <span className="bokeh" style={{ width: 40, height: 40, top: 150, left: "40%", background: "#ffd36b" }} />
        <span className="bokeh" style={{ width: 80, height: 80, bottom: 40, right: 20, background: "#ff3c82" }} />
        <span className="bokeh hidden md:block" style={{ width: 120, height: 120, top: 40, right: "35%", background: "#f5b301" }} />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
          <div>
            <p className="font-script text-2xl text-oro-400 md:text-3xl">Tu comunidad tardícola</p>
            <h1 className="mt-1 font-display text-[2.7rem] font-black leading-[1.05] md:text-6xl lg:text-7xl">
              El buscador de <span className="text-marca italic">tardeos</span> que va contigo
            </h1>
            <p className="mt-3 font-script text-2xl text-white/90 md:text-3xl">Sal, conecta y vive el tardeo ✨</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tardeos"
                className="flex items-center justify-center gap-2 rounded-2xl bg-oro px-6 py-4 text-lg font-extrabold text-tinta shadow-lg transition hover:brightness-105 active:scale-[0.98]"
              >
                <CalendarDays size={22} /> Ver tardeos
              </Link>
              <Link
                href="/tardeos"
                className="glass flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold text-white transition hover:bg-white/20 active:scale-[0.98]"
              >
                <SlidersHorizontal size={22} /> Filtrar tardeos
              </Link>
            </div>

            <a
              href="https://chat.whatsapp.com/KMAxRPoj36w6cOSGGwnZhi?mode=ems_wa_c"
              target="_blank"
              rel="noopener noreferrer"
              className="group glass mt-4 flex items-center gap-3 rounded-2xl p-2.5 pr-4 transition hover:bg-white/20 active:scale-[0.98]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white shadow-lg">
                <MessageCircle size={24} fill="currentColor" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-extrabold leading-tight text-white">Comunidad de WhatsApp</span>
                <span className="block text-sm font-semibold text-white/75">Entérate de los tardeos al momento</span>
              </span>
              <ArrowRight size={20} className="shrink-0 text-white/70 transition group-hover:translate-x-1" />
            </a>
          </div>

          <Link href="/mapa" className="block">
            <div className="glass overflow-hidden rounded-3xl p-2">
              <div className="relative h-44 overflow-hidden rounded-2xl md:h-80">
                <div className="pointer-events-none absolute inset-0">
                  {/* Le pasamos los tardeos que ya trajo el servidor: sin esto
                      el mapa los volvía a pedir por su cuenta al montarse. */}
                  <MapaClient tardeos={tardeos} />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 font-extrabold text-white">
                    <MapPin size={18} className="text-oro-400" /> Tardeos cerca de ti
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-white/90">
                    Ver mapa <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Carruseles y secciones */}
      <CarruselTardeos
        titulo={hayDestacados
          ? <>Destacados <Sparkles size={22} className="text-oro" /></>
          : <>Próximos tardeos <CalendarDays size={22} className="text-oro" /></>}
        tardeos={destacados}
      />
      {/* Solo se pinta si has dicho qué te gusta y hay planes que encajen.
          Va aquí y no arriba del todo porque el hero y los destacados son lo
          que ve todo el mundo, con sesión o sin ella. */}
      <ParaTi tardeos={tardeos} />

      <CarruselTardeos titulo={<>Este finde <Sun size={22} className="text-oro" /></>} tardeos={esteFinde} />

      {/* Locales antes que DJs: el local es quien paga y quien pone el sitio;
          el DJ acompaña. */}
      <LocalesDestacados locales={localesTop.locales} sonDePago={localesTop.sonDePago} />
      <DjsDestacados djs={djs.slice(0, 10)} />
      <ZonasRapidas zonas={zonas} />
      <NexoRadio />
      <CtaLocalDj />
      <Footer />
      <PopupCliente />
    </main>
  );
}
