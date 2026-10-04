import Image from "next/image";
import { formatFecha, flyerSrc } from "@/lib/formato";
import { getTardeoById } from "@/lib/tardeos";
import AccionTardeo from "@/components/AccionTardeo";
import Resenas from "@/components/Resenas";
import CompartirBtn from "@/components/CompartirBtn";
import RegistrarVista from "@/components/RegistrarVista";
import MiniMapa from "@/components/MiniMapa";
import DestacarTardeo from "@/components/DestacarTardeo";
import { notFound } from "next/navigation";
import Link from "next/link";
import EnlaceExterno from "@/components/EnlaceExterno";
import DenunciarFlyer from "@/components/DenunciarFlyer";
import type { Metadata } from "next";
import DatosEstructurados from "@/components/DatosEstructurados";
import { jsonLdEvento, urlAbsoluta } from "@/lib/seo";
import { getPromosDeTardeo } from "@/lib/promociones";
import { ArrowLeft, MapPin, Clock, Music, BadgeCheck, Star, CalendarPlus, Sparkles, Users, Shirt, PartyPopper, Tag, Car, ShieldCheck } from "lucide-react";
import { tieneValoracion, valoracion } from "@/lib/reputacion";

export const dynamic = "force-dynamic";

function fmtCal(fecha: string, hora: string) {
  return fecha.replace(/-/g, "") + "T" + (hora || "00:00").replace(":", "") + "00";
}
/**
 * El día siguiente, para los tardeos que acaban de madrugada.
 *
 * TODO EN UTC, y no es purismo. Antes decía `new Date(f + "T00:00:00")`, que el
 * navegador entiende como medianoche LOCAL: en Madrid son las 22:00 UTC del día
 * anterior. Al sumar un día y volver a `toISOString()` se recuperaba la fecha
 * de partida, así que el +1 no se aplicaba nunca.
 *
 * El síntoma era serio y silencioso: un tardeo de 22:00 a 02:00 le mandaba a
 * Google Calendar `…T220000 / …T020000` del MISMO día, con el fin antes que el
 * inicio. Google descarta el evento o lo crea de cero minutos, y el que lo
 * añadió no se entera hasta que no le suena la alarma.
 */
function sumarDia(fechaISO: string) {
  const d = new Date(fechaISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
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
  const promos = await getPromosDeTardeo(id);

  /**
   * Las horas van SIN zona y con `ctz=Europe/Madrid` aparte, que es como lo
   * espera Google: la hora es la del tardeo y la zona se declara una vez.
   *
   * Sin `ctz`, Google las interpretaba en la zona de quien mira. Un tardeo de
   * Mataró a las 18:00 le salía a las 17:00 a alguien en Londres y a las 19:00
   * a alguien en Atenas, sin ningún aviso.
   */
  const ini = fmtCal(tardeo.fecha, tardeo.horaInicio || "18:00");
  const fechaFin = tardeo.horaFin && tardeo.horaFin < (tardeo.horaInicio || "18:00") ? sumarDia(tardeo.fecha) : tardeo.fecha;
  const fin = fmtCal(fechaFin, tardeo.horaFin || tardeo.horaInicio || "20:00");
  const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tardeo.titulo)}&dates=${ini}/${fin}&location=${encodeURIComponent(tardeo.local.direccion || "")}&details=${encodeURIComponent(`Tardeo en ${tardeo.local.nombre} · TardeosClub`)}&ctz=Europe/Madrid`;

  return (
    <main className="mx-auto max-w-3xl pb-28 md:pb-12">
      {/* Para que Google lo enseñe como evento —con fecha, sitio y precio en
          el propio resultado— y no como un enlace más. */}
      <DatosEstructurados datos={jsonLdEvento(tardeo)} />
      <RegistrarVista tipo="tardeo" id={tardeo.id} />
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
          {/* Sello Recomendado para destacados */}
          {tardeo.destacado_hasta && new Date(tardeo.destacado_hasta) > new Date() && (
            <div className="absolute right-2 top-2 z-20 w-12 h-12 md:w-16 md:h-16 pointer-events-none">
              <Image
                src="/branding/SELLO VERIFICADO_TARDEOSCLUB.png"
                alt="Sello Recomendado"
                fill
                className="object-contain"
              />
            </div>
          )}
        </div>
      </div>

      <div className="px-4">
        <h1 className="mt-4 text-3xl font-black leading-tight">{tardeo.titulo}</h1>

        <div className="mt-3 flex flex-col gap-2 text-base font-semibold text-tinta/80">
          <span className="inline-flex items-center gap-2">
            <Clock size={20} className="text-magenta" /> {formatFecha(tardeo.fecha)} · {tardeo.horaInicio}–{tardeo.horaFin}
          </span>
          {/*
            Sin nombre de local no se pinta el enlace: se pinta la dirección con
            su icono y ya.

            Pasa de verdad, y no por un dato mal metido: si el local está en
            borrador, la consulta pública NO puede leerlo —lo filtra la política
            de la base— y llega vacío. Antes eso dejaba un icono de ubicación
            solo, en una línea, enlazando a una ficha que tampoco se puede ver.
          */}
          {tardeo.local.nombre ? (
            <>
              <Link href={`/locales/${tardeo.local.id}`} className="inline-flex items-center gap-2 transition hover:text-magenta">
                <MapPin size={20} className="text-magenta" /> {tardeo.local.nombre}
                {tardeo.local.verificado && <BadgeCheck size={18} className="text-oro-600" />}
              </Link>
              {tardeo.local.direccion && (
                <span className="pl-7 text-sm text-tinta/60">{tardeo.local.direccion}</span>
              )}
            </>
          ) : tardeo.local.direccion ? (
            <span className="inline-flex items-start gap-2">
              <MapPin size={20} className="mt-0.5 shrink-0 text-magenta" /> {tardeo.local.direccion}
            </span>
          ) : null}
          {/* Solo si hay estilo. Sin esta condición, un tardeo sin música
              dejaba el icono solo, ocupando una línea entera sin nada al lado:
              parece que falta cargar algo. */}
          {tardeo.estilo && (
            <span className="inline-flex items-center gap-2">
              <Music size={20} className="text-magenta" /> {tardeo.estilo}
            </span>
          )}
        </div>

        {/* Ambiente, público y outfit. Solo se pinta lo que esté puesto: los 662
            tardeos migrados llegaron sin nada de esto, y una fila de etiquetas
            vacías haría parecer que a la ficha le falta algo. */}
        {(tardeo.tipoEvento || (tardeo.ambiente?.length ?? 0) > 0 || (tardeo.publico?.length ?? 0) > 0 || tardeo.dressCode) && (
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

        {/* Etiquetas: rótulos cortos, sin código ni fechas. Las promociones
            de verdad van justo debajo, en su propio bloque.

            El `> 0` no sobra: `etiquetas` se mapea a [] cuando viene vacía, y
            `[].length` es 0, que en JSX React PINTA como un cero suelto en
            medio de la ficha en vez de no pintar nada. */}
        {(tardeo.etiquetas?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tardeo.etiquetas!.map((e) => (
              <span key={e} className="rounded-full bg-oro px-3 py-1 text-sm font-black text-tinta">{e}</span>
            ))}
          </div>
        )}

        {/* Las promociones vigentes. La base solo devuelve esas: una caducada
            no es que no se pinte, es que no se puede leer. Aquí y no en la
            portada, que la ve quien ya ha entrado a mirar este tardeo. */}
        {promos.map((p) => (
          <div key={p.id} className="mt-4 rounded-2xl bg-oro/15 p-4 ring-1 ring-oro/40">
            <p className="flex items-center gap-2 font-display text-lg font-black leading-tight">
              <Tag size={19} className="shrink-0 text-oro-600" /> {p.nombre}
            </p>
            {p.beneficio && <p className="mt-1 font-semibold text-tinta/75">{p.beneficio}</p>}
            {p.codigo && (
              <p className="mt-2 text-sm font-bold text-tinta/70">
                Con el código{" "}
                <span className="rounded bg-tinta px-2 py-1 font-mono font-black text-white">{p.codigo}</span>
              </p>
            )}
            {p.hasta && (
              <p className="mt-2 text-xs font-bold text-tinta/50">
                Hasta el {new Date(p.hasta).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
              </p>
            )}
          </div>
        ))}

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
                {tieneValoracion(dj.reputacion) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-oro/15 px-2.5 py-1 text-sm font-black text-oro-600">
                    <Star size={14} fill="currentColor" /> {valoracion(dj.reputacion)}
                  </span>
                )}
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
            <div className="grid grid-cols-2 divide-x divide-black/5 border-t border-black/5">
              <EnlaceExterno
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  tardeo.local.direccion || `${tardeo.lat},${tardeo.lng}`
                )}`}
                canal="mapa" localId={tardeo.local.id} tardeoId={tardeo.id}
                className="flex items-center justify-center gap-2 bg-white py-3 text-sm font-extrabold text-magenta transition hover:bg-magenta-50"
              >
                <MapPin size={16} /> Cómo llegar
              </EnlaceExterno>
              {/*
                Pedir taxi.
                Busca taxis CERCA DEL SITIO, no en una aplicación concreta. Es
                deliberado: elegir Uber, Free Now o Cabify es una decisión
                comercial de Tardeos Club, no técnica, y mientras no haya
                acuerdo con ninguna, mandar a la gente a una es hacerle
                publicidad gratis. Esto funciona en toda Cataluña, con o sin
                aplicación instalada, y el día que haya acuerdo se cambia la
                dirección de una línea.
              */}
              <EnlaceExterno
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `taxi ${tardeo.lat},${tardeo.lng}`
                )}`}
                canal="taxi" localId={tardeo.local.id} tardeoId={tardeo.id}
                className="flex items-center justify-center gap-2 bg-white py-3 text-sm font-extrabold text-magenta transition hover:bg-magenta-50"
              >
                <Car size={16} /> Pedir taxi
              </EnlaceExterno>
            </div>
          </div>

          {/*
            Vuelve seguro.
            Va DESPUÉS del mapa y del taxi, que es donde tiene sentido: cuando
            alguien mira cómo se va. Y va en un tono tranquilo a propósito: un
            aviso con signos de exclamación en una página de fiesta se salta,
            y este es el único texto de la web que habla de volver a casa.
          */}
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-crema/70 p-3 text-sm font-semibold text-tinta/70 ring-1 ring-black/5">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-magenta" />
            <span>
              <b className="font-black text-tinta">Vuelve seguro.</b> Si has bebido, no cojas el
              coche: pide un taxi ahí arriba o vuelve acompañado.
            </span>
          </p>
        </section>

        <DestacarTardeo localId={tardeo.local.id} tardeoId={tardeo.id} titulo={tardeo.titulo} />

        <Resenas tipo="local" objetivoId={tardeo.local.id} nombre={tardeo.local.nombre} />

        {/* Lo último de la página, en letra pequeña. La mayoría de los flyers
            están bien; esto es para el que no lo está. */}
        <DenunciarFlyer tardeoId={tardeo.id} flyerUrl={flyerSrc(tardeo)} />
      </div>

      <AccionTardeo tardeo={tardeo} />
    </main>
  );
}
