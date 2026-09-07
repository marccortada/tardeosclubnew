import Image from "next/image";
import { getLocalById, getTardeosPublicadosDeLocal } from "@/lib/tardeos";
import TardeoCard from "@/components/TardeoCard";
import Resenas from "@/components/Resenas";
import Playlist from "@/components/Playlist";
import CompartirBtn from "@/components/CompartirBtn";
import { notFound } from "next/navigation";
import Link from "next/link";
import { enlacesDe } from "@/lib/redes";
import type { Metadata } from "next";
import DatosEstructurados from "@/components/DatosEstructurados";
import { jsonLdLocal, urlAbsoluta } from "@/lib/seo";
import { ArrowLeft, MapPin, Phone, BadgeCheck, Store, CalendarDays , Megaphone, Instagram, Globe, CalendarCheck } from "lucide-react";
import ReclamarFicha from "@/components/ReclamarFicha";
import AdnLocalFicha from "@/components/AdnLocalFicha";
import RegistrarVista from "@/components/RegistrarVista";
import { sinMarcas } from "@/lib/texto";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const local = await getLocalById(id);
  if (!local) return { title: "Local no encontrado · TardeosClub" };
  const desc = `Tardeos en ${local.nombre}${local.zona ? ` · ${local.zona}` : ""}. ${local.descripcion || "Descúbrelos en TardeosClub."}`;
  const fotos: string[] = Array.isArray(local.fotos) ? local.fotos : [];
  return {
    title: `${local.nombre} · TardeosClub`,
    description: desc,
    alternates: { canonical: urlAbsoluta(`/locales/${id}`) },
    openGraph: {
      title: local.nombre,
      description: desc,
      images: fotos[0] ? [{ url: fotos[0] }] : undefined,
      url: urlAbsoluta(`/locales/${id}`),
      type: "website",
    },
  };
}

export default async function PaginaLocal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const local = await getLocalById(id);
  if (!local) notFound();

  const tardeos = await getTardeosPublicadosDeLocal(id);
  const fotos: string[] = Array.isArray(local.fotos) ? local.fotos : [];
  const tel = (local.telefono || "").replace(/\s+/g, "");
  /**
   * Instagram, web y reservas, que estaban guardados y no se veían.
   *
   * 46 de los 60 locales activos traen algo en `redes` desde la migración —45
   * con Instagram— y hasta ahora ninguna pantalla los enseñaba. Era el dato más
   * útil de la ficha después de la dirección, y estaba en la base sin usar.
   */
  const redes = enlacesDe(local.redes);

  return (
    <main className="mx-auto max-w-4xl pb-12">
      {/* Negocio + su cartelera, para que Google entienda que esto es un sitio
          real con eventos y no una página suelta. */}
      <DatosEstructurados datos={jsonLdLocal(local, tardeos)} />
      {/* Portada */}
      <div className="relative h-44 overflow-hidden bg-marca md:h-60">
        {/*
          Orden: foto de galería, y si no hay, EL LOGO difuminado de fondo.
          Antes solo se miraba `fotos`, y resulta que ningún local tiene fotos
          mientras que 57 de los 65 activos sí tienen logo: las 65 fichas
          enseñaban un icono genérico teniendo su marca guardada. La de DJ sí
          usaba su avatar, así que además no se parecían entre ellas.
        */}
        {fotos[0] ? (
          <Image src={fotos[0]} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        ) : local.logo_url ? (
          <Image
            src={local.logo_url} alt="" fill sizes="(max-width: 768px) 100vw, 768px"
            className="scale-110 object-cover opacity-60 blur-xl"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-marca text-white/30"><Store size={72} /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <Link href="/tardeos" aria-label="Volver" className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-tinta shadow transition hover:bg-white active:scale-95">
          <ArrowLeft size={22} />
        </Link>
        <CompartirBtn
          titulo={local.nombre}
          texto={`Mira los tardeos de ${local.nombre} en TardeosClub`}
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-tinta shadow transition hover:bg-white active:scale-95"
        />
      </div>

      <div className="px-4 md:px-8">
        {/* Cabecera */}
        {/* Su marca, si la tiene. Es lo primero que mira quien abre la ficha
            para saber si ha llegado al sitio correcto. */}
        {local.logo_url ? (
          <Image
            src={local.logo_url} alt={local.nombre} width={80} height={80}
            className="-mt-10 h-20 w-20 rounded-3xl bg-white object-cover shadow-tarjeta ring-1 ring-black/5"
          />
        ) : (
          <span className="-mt-10 grid h-20 w-20 place-items-center rounded-3xl bg-white text-magenta shadow-tarjeta ring-1 ring-black/5">
            <Store size={38} />
          </span>
        )}
        <h1 className="mt-3 flex items-center gap-2 font-display text-2xl font-black leading-tight md:text-3xl">
          {local.nombre}
          {local.verificado && <BadgeCheck size={22} className="shrink-0 text-oro-600" />}
        </h1>
        {/* Un promotor no tiene zona ni dirección fija, así que sin esto su
            ficha parece la de un local al que le faltan datos. */}
        {local.tipo === "promotor" ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-magenta-50 px-3 py-1 text-sm font-black text-magenta">
            <Megaphone size={14} /> Promotor de eventos
          </p>
        ) : (
          local.zona && <p className="text-sm font-bold text-tinta/60">{local.zona}</p>
        )}

        {local.descripcion && <p className="mt-4 whitespace-pre-line font-semibold text-tinta/80">{sinMarcas(local.descripcion)}</p>}

        {/* Datos de contacto */}
        <div className="mt-4 flex flex-wrap gap-2">
          {local.direccion && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(local.direccion)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-tinta shadow-tarjeta ring-1 ring-black/5 transition hover:ring-magenta"
            >
              <MapPin size={16} className="text-magenta" /> Cómo llegar
            </a>
          )}
          {tel && (
            <a
              href={`https://wa.me/${tel.startsWith("34") || tel.startsWith("+") ? tel.replace("+", "") : "34" + tel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-extrabold text-white shadow-tarjeta transition hover:brightness-105"
            >
              <Phone size={16} /> WhatsApp
            </a>
          )}
          {redes.map((r) => {
            const Icono = r.k === "instagram" ? Instagram : r.k === "reservas" ? CalendarCheck : Globe;
            return (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-tinta shadow-tarjeta ring-1 ring-black/5 transition hover:ring-magenta"
              >
                <Icono size={16} className="text-magenta" /> {r.label}
              </a>
            );
          })}
        </div>

        {/* Cómo es el sitio. Antes de los tardeos: quien entra a una ficha de
            local quiere saber a dónde va, y el qué-hay-hoy ya lo tiene en
            /tardeos. */}
        <RegistrarVista tipo="local" id={local.id} />

        <AdnLocalFicha local={local} />

        {/* Tardeos del local */}
        <section className="mt-7">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-black md:text-2xl">
            <CalendarDays size={22} className="text-magenta" /> Próximos tardeos
          </h2>
          {tardeos.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
              Este local aún no tiene tardeos publicados.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              {tardeos.map((t) => (
                <TardeoCard key={t.id} tardeo={t} />
              ))}
            </div>
          )}
        </section>

        {/* Lo que suena en el sitio. Vale igual para promotores: comparten
            ficha con los locales. */}
        <Playlist url={local.playlist_url} titulo="Lo que suena aquí" />

        {/* Reseñas */}
        {/* Solo si no la lleva nadie. En cuanto la reclamen desaparece. */}
        {local.sinDueno && (
          <ReclamarFicha tipo="local" objetivoId={local.id} nombre={local.nombre} />
        )}

        <Resenas tipo="local" objetivoId={local.id} nombre={local.nombre} />
      </div>
    </main>
  );
}
