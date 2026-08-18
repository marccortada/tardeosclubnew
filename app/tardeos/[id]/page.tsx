import Image from "next/image";
import { formatFecha, flyerSrc } from "@/lib/mockData";
import { getTardeoById } from "@/lib/tardeos";
import AccionTardeo from "@/components/AccionTardeo";
import Resenas from "@/components/Resenas";
import CompartirBtn from "@/components/CompartirBtn";
import RegistrarVisita from "@/components/RegistrarVisita";
import MiniMapa from "@/components/MiniMapa";
import DestacarTardeo from "@/components/DestacarTardeo";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import DatosEstructurados from "@/components/DatosEstructurados";
import { jsonLdEvento, urlAbsoluta } from "@/lib/seo";
import { ArrowLeft, MapPin, Clock, Music, BadgeCheck, Star, CalendarPlus, Sparkles, Users, Shirt, PartyPopper, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtCal(fecha: string, hora: string) {
  return fecha.replace(/-/g, "") + "T" + (hora || "00:00").replace(":", "") + "00";
}
function sumarDia(fechaISO: string) {
  const d = new Date(fechaISO + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tardeo = await getTardeoById(id);
  if (!tardeo) return { title: "Tardeo no encontrado · TardeosClub" };

  const desc = `${formatFecha(tardeo.fecha)} · ${tardeo.local.nombre} (${tardeo.zona})${tardeo.estilo ? ` · ${tardeo.estilo}` : ""}. Descúbrelo en TardeosClub.`;
  const img = flyerSrc(tardeo);

  return {
    title: `${tardeo.titulo} · TardeosClub`,
    description: desc,
    // Imprescindible: sin esto hereda la canónica de app/tardeos/layout.tsx y
    // la ficha le diría a Google que la página buena es el listado.
    alternates: { canonical: urlAbsoluta(`/tardeos/${id}`) },
    openGraph: {
      title: tardeo.titulo,
      description: desc,
      images: [{ url: img }],
      url: urlAbsoluta(`/tardeos/${id}`),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: tardeo.titulo,
      description: desc,
      images: [img],
    },
  };
}

export default async function FichaTardeo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tardeo = await getTardeoById(id);
  if (!tardeo) notFound();

  const ini = fmtCal(tardeo.fecha, tardeo.horaInicio || "18:00");
  const fechaFin = tardeo.horaFin && tardeo.horaFin < (tardeo.horaInicio || "18:00") ? sumarDia(tardeo.fecha) : tardeo.fecha;
  const fin = fmtCal(fechaFin, tardeo.horaFin || tardeo.horaInicio || "20:00");
  const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tardeo.titulo)}&dates=${ini}/${fin}&location=${encodeURIComponent(tardeo.local.direccion || "")}&details=${encodeURIComponent(`Tardeo en ${tardeo.local.nombre} · TardeosClub`)}`;

  return (
    <main className="mx-auto max-w-3xl pb-28 md:pb-12">
      {/* Para que Google lo enseñe como evento —con fecha, sitio y precio en
          el propio resultado— y no como un enlace más. */}
      <DatosEstructurados datos={jsonLdEvento(tardeo)} />
      <RegistrarVisita tardeoId={tardeo.id} />
      <div className="relative px-4 pt-4 md:pt-8">
        <Link
          href="/tardeos"
          aria-label="Volver a tardeos"
          className="absolute left-6 top-6 z-20 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-tinta shadow transition hover:bg-white active:scale-95"
        >
          <ArrowLeft size={22} />
        </Link>
        <CompartirBtn
          titulo={tardeo.titulo}
          texto={`¡Mira este tardeo! ${tardeo.titulo} — ${formatFecha(tardeo.fecha)} en ${tardeo.local.nombre}`}
          className="absolute right-6 top-6 z-20 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-tinta shadow transition hover:bg-white active:scale-95"
        />
        {/* scrim para legibilidad del botón volver */}
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 h-20 rounded-t-3xl bg-gradient-to-b from-black/35 to-transparent md:left-1/2 md:w-full md:max-w-sm md:-translate-x-1/2" />
        {/* Flyer vertical completo */}
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl bg-tinta">
          {/* El fondo va difuminado: con una miniatura basta. */}
          <Image
            src={flyerSrc(tardeo)}
            alt=""
            aria-hidden="true"
            fill
            sizes="32px"
            className="scale-125 object-cover opacity-70 blur-2xl"
          />
          <Image
            src={flyerSrc(tardeo)}
            alt={`Flyer de ${tardeo.titulo}`}
            fill
            // Es la imagen principal de la página: que empiece a bajar ya.
            priority
            sizes="(max-width: 640px) 100vw, 384px"
            className="relative z-10 object-contain"
          />
        </div>
      </div>

      <div className="px-4">
        <h1 className="mt-4 text-3xl font-black leading-tight">{tardeo.titulo}</h1>

        <div className="mt-3 flex flex-col gap-2 text-base font-semibold text-tinta/80">
          <span className="inline-flex items-center gap-2 capitalize">
            <Clock size={20} className="text-magenta" /> {formatFecha(tardeo.fecha)} · {tardeo.horaInicio}–{tardeo.horaFin}
          </span>
          <Link href={`/locales/${tardeo.local.id}`} className="inline-flex items-center gap-2 transition hover:text-magenta">
            <MapPin size={20} className="text-magenta" /> {tardeo.local.nombre}
            {tardeo.local.verificado && <BadgeCheck size={18} className="text-oro-600" />}
          </Link>
          <span className="pl-7 text-sm text-tinta/60">{tardeo.local.direccion}</span>
          <span className="inline-flex items-center gap-2">
            <Music size={20} className="text-magenta" /> {tardeo.estilo}
          </span>
        </div>

        {/* Ambiente, público y outfit. Solo se pinta lo que esté puesto: los 662
            tardeos migrados llegaron sin nada de esto, y una fila de etiquetas
            vacías haría parecer que a la ficha le falta algo. */}
        {(tardeo.tipoEvento || tardeo.ambiente?.length || tardeo.publico?.length || tardeo.dressCode) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tardeo.tipoEvento && (
              <span className="inline-flex items-center gap-1 rounded-full bg-marca px-3 py-1.5 text-sm font-extrabold text-white">
                <PartyPopper size={13} /> {tardeo.tipoEvento}
              </span>
            )}
            {tardeo.ambiente?.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-magenta-50 px-3 py-1.5 text-sm font-extrabold text-magenta-700">
                <Sparkles size={13} /> {a}
              </span>
            ))}
            {tardeo.publico?.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-tinta/70 ring-1 ring-magenta-100">
                <Users size={13} className="text-magenta" /> {p}
              </span>
            ))}
            {tardeo.dressCode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-tinta/70 ring-1 ring-magenta-100">
                <Shirt size={13} className="text-magenta" /> {tardeo.dressCode}
              </span>
            )}
          </div>
        )}

        {/* La promoción del local. Aquí y no en la portada: la ve quien ya ha
            entrado a mirar este tardeo, así que no interrumpe a nadie. */}
        {(tardeo.promoTitulo || tardeo.etiquetas?.length) && (
          <div className="mt-4 rounded-2xl bg-oro/15 p-4 ring-1 ring-oro/40">
            {tardeo.promoTitulo && (
              <p className="flex items-center gap-2 font-display text-lg font-black leading-tight">
                <Tag size={19} className="shrink-0 text-oro-600" /> {tardeo.promoTitulo}
              </p>
            )}
            {tardeo.promoTexto && <p className="mt-1 font-semibold text-tinta/75">{tardeo.promoTexto}</p>}
            {tardeo.etiquetas?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tardeo.etiquetas.map((e) => (
                  <span key={e} className="rounded-full bg-oro px-3 py-1 text-sm font-black text-tinta">{e}</span>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <a
          href={calUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-magenta-50 px-4 py-2.5 text-sm font-extrabold text-magenta transition hover:bg-magenta-100"
        >
          <CalendarPlus size={18} /> Añadir al calendario
        </a>

        {/* DJs */}
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-black">DJs</h2>
          <div className="flex flex-col gap-2">
            {tardeo.djs.map((dj) => (
              <Link key={dj.id} href={`/djs/${dj.id}`} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-tarjeta ring-1 ring-magenta-100 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center gap-3">
                  {dj.avatar ? (
                    <Image src={dj.avatar} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-marca font-black text-white">
                      {dj.nombre.replace("DJ ", "").charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="inline-flex items-center gap-1 font-black">
                      {dj.nombre}
                      {dj.verificado && <BadgeCheck size={16} className="text-oro-600" />}
                    </p>
                    <p className="text-xs font-semibold text-tinta/60">{dj.estilos.join(" · ")}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-oro/15 px-2.5 py-1 text-sm font-black text-oro-600">
                  <Star size={14} fill="currentColor" /> {dj.reputacion}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Dónde es */}
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-black">Dónde es</h2>
          <div className="overflow-hidden rounded-2xl ring-1 ring-magenta-100">
            {tardeo.lat && tardeo.lng ? (
              <MiniMapa lat={tardeo.lat} lng={tardeo.lng} />
            ) : (
              <div className="grid h-40 place-items-center bg-[#dce7dd] text-magenta">
                <MapPin size={38} fill="#E10A5A" className="text-white" />
              </div>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                tardeo.local.direccion || `${tardeo.lat},${tardeo.lng}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white py-3 text-sm font-extrabold text-magenta transition hover:bg-magenta-50"
            >
              <MapPin size={16} /> Cómo llegar
            </a>
          </div>
        </section>

        <DestacarTardeo localId={tardeo.local.id} tardeoId={tardeo.id} titulo={tardeo.titulo} />

        <Resenas tipo="local" objetivoId={tardeo.local.id} nombre={tardeo.local.nombre} />
      </div>

      <AccionTardeo tardeo={tardeo} />
    </main>
  );
}
