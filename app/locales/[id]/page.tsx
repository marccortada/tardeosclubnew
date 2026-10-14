import Image from "next/image";
import { getLocalById, getTardeosPublicadosDeLocal } from "@/lib/tardeos";
import TardeoCard from "@/components/TardeoCard";
import Resenas from "@/components/Resenas";
import Playlist from "@/components/Playlist";
import CompartirBtn from "@/components/CompartirBtn";
import { notFound } from "next/navigation";
import Link from "next/link";
import { enlacesDe, type Red } from "@/lib/redes";
import EnlaceExterno from "@/components/EnlaceExterno";
import type { Metadata } from "next";
import type { Canal } from "@/lib/metricas";
import DatosEstructurados from "@/components/DatosEstructurados";
import { jsonLdLocal, urlAbsoluta } from "@/lib/seo";
import {
  ArrowLeft, MapPin, BadgeCheck, Store, Megaphone, Instagram, Globe, CalendarCheck,
  Navigation, MessageCircle, Bell, ArrowRight, Images,
} from "lucide-react";
import { claseBoton } from "@/components/Boton";
import ReclamarFicha from "@/components/ReclamarFicha";
import AdnLocalFicha from "@/components/AdnLocalFicha";
import RegistrarVista from "@/components/RegistrarVista";
import MiniMapa from "@/components/MiniMapa";
import { LogoLocal, tipoDeLocal } from "@/components/LocalCard";
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

/** Un botón de contacto: a dónde lleva, cómo se mide y cómo se ve. */
type Accion = { href: string; canal: Canal; label: string; icono: typeof MapPin };

const TITULO = "font-display text-[24px] font-bold leading-tight md:text-[30px]";

export default async function PaginaLocal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const local = await getLocalById(id);
  if (!local) notFound();

  const tardeos = await getTardeosPublicadosDeLocal(id);
  const fotos: string[] = (Array.isArray(local.fotos) ? local.fotos : []).filter((f: unknown) => typeof f === "string" && f);
  const portada = fotos[0] ?? null;
  const tel = (local.telefono || "").replace(/\s+/g, "");
  /**
   * Instagram, web y reservas, que estaban guardados y no se veían.
   *
   * 46 de los 60 locales activos traen algo en `redes` desde la migración —45
   * con Instagram— y hasta ahora ninguna pantalla los enseñaba.
   */
  const redes = enlacesDe(local.redes);
  const instagram = redes.find((r) => r.k === "instagram") ?? null;

  const esPromotor = local.tipo === "promotor";
  const lat = Number(local.lat);
  const lng = Number(local.lng);
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

  // Google Maps busca mejor por «nombre, dirección» (encuentra la ficha del
  // sitio); sin dirección, por coordenadas, que nunca fallan.
  const consultaMapa = local.direccion
    ? `${local.nombre}, ${local.direccion}`
    : tieneCoords ? `${lat},${lng}` : null;
  const urlMapa = consultaMapa
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consultaMapa)}`
    : null;

  const iconoRed = (k: Red["k"]) => (k === "instagram" ? Instagram : k === "reservas" ? CalendarCheck : Globe);
  const acciones: Accion[] = [
    ...(tel
      ? [{
          href: `https://wa.me/${tel.startsWith("34") || tel.startsWith("+") ? tel.replace("+", "") : "34" + tel}`,
          canal: "whatsapp" as Canal, label: "WhatsApp", icono: MessageCircle,
        }]
      : []),
    ...redes.map((r) => ({ href: r.url, canal: (r.k === "facebook" ? "web" : r.k) as Canal, label: r.label, icono: iconoRed(r.k) })),
    ...(urlMapa && !esPromotor ? [{ href: urlMapa, canal: "mapa" as Canal, label: "Cómo llegar", icono: Navigation }] : []),
  ];

  const etiquetas = [tipoDeLocal(local), local.tipo_local].filter(Boolean) as string[];
  const conMapa = !esPromotor && (tieneCoords || Boolean(local.direccion));
  // Sin contacto ni mapa, una sola columna: un lateral vacío parece un fallo.
  const conLateral = acciones.length > 0 || conMapa;
  const ubicacion = esPromotor ? "Organiza en distintos sitios" : local.zona || local.direccion || null;

  return (
    <main className="pb-16">
      {/* Negocio + su cartelera, para que Google entienda que esto es un sitio
          real con eventos y no una página suelta. */}
      <DatosEstructurados datos={jsonLdLocal(local, tardeos)} />
      <RegistrarVista tipo="local" id={local.id} />

      {/* ── Cabecera ─────────────────────────────────────────────────────────
          Con foto: la foto a sangre con un degradado para leer encima. Sin
          foto (casi todos): una banda oscura de marca, nunca un bloque gris
          vacío. El logo va siempre sobre fondo oscuro: muchos son PNG blancos. */}
      <header className="relative isolate overflow-hidden bg-tinta text-white">
        {portada ? (
          <>
            <Image src={portada} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#141014_0%,#2B0A26_50%,#930E72_100%)]">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-magenta-400/30 blur-3xl" />
            <div className="absolute -bottom-40 right-1/4 h-72 w-72 rounded-full bg-naranja/20 blur-3xl" />
          </div>
        )}

        <div className={`mx-auto flex max-w-6xl flex-col px-4 pb-7 pt-3 md:px-8 md:pb-10 md:pt-5 ${portada ? "min-h-[360px] md:min-h-[460px]" : "min-h-[300px] md:min-h-[360px]"}`}>
          <div className="flex items-center justify-between">
            <Link href="/colaboradores" className="-ml-2 inline-flex min-h-tacto items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold text-white/90 transition hover:bg-white/10">
              <ArrowLeft size={20} aria-hidden /> Locales
            </Link>
            <CompartirBtn
              titulo={local.nombre}
              texto={`Mira los tardeos de ${local.nombre} en TardeosClub`}
              className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 active:scale-95"
            />
          </div>

          <div className="mt-auto flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:gap-6">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-tinta shadow-elevada ring-2 ring-white/20 md:h-36 md:w-36">
              <LogoLocal local={local} sizes="144px" priority textoClase="text-3xl md:text-5xl" relleno="p-[10%]" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {etiquetas.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white backdrop-blur">
                    {e === tipoDeLocal(local) && (esPromotor ? <Megaphone size={13} aria-hidden /> : <Store size={13} aria-hidden />)}
                    {e}
                  </span>
                ))}
                {local.verificado && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-oro px-3 py-1 text-[13px] font-bold text-tinta">
                    <BadgeCheck size={14} aria-hidden /> Verificado
                  </span>
                )}
              </div>
              <h1 className="break-words font-display text-[34px] font-bold leading-[1.08] md:text-[54px]">{local.nombre}</h1>
              {ubicacion && (
                <p className="mt-2 flex items-start gap-1.5 text-[16px] font-medium text-white/85 md:text-[17px]">
                  {esPromotor ? <Megaphone size={18} className="mt-0.5 shrink-0" aria-hidden /> : <MapPin size={18} className="mt-0.5 shrink-0" aria-hidden />}
                  {ubicacion}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 md:px-8">
        {/* Contacto en el móvil: justo debajo de la cabecera, a mano del pulgar.
            En escritorio va en la columna lateral. */}
        {acciones.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-5 lg:hidden">
            {acciones.map((a, i) => (
              <BotonAccion key={a.href} accion={a} localId={local.id} principal={i === 0} ancho={acciones.length % 2 === 1 && i === 0} />
            ))}
          </div>
        )}

        <div className={`grid gap-10 pt-8 lg:gap-12 lg:pt-10 ${conLateral ? "lg:grid-cols-[minmax(0,1fr)_340px]" : "max-w-4xl"}`}>
          <div className="flex min-w-0 flex-col gap-10">
            {local.descripcion && (
              <section>
                <h2 className={TITULO}>Sobre {esPromotor ? "sus eventos" : "el sitio"}</h2>
                <p className="mt-3 max-w-3xl whitespace-pre-line text-[16px] leading-relaxed text-tinta md:text-[17px]">{sinMarcas(local.descripcion)}</p>
              </section>
            )}

            {/* Tardeos del local: lo que más se busca, antes que el ADN. */}
            <section>
              <div className="flex items-end justify-between gap-3">
                <h2 className={TITULO}>Próximos tardeos</h2>
                {tardeos.length > 0 && (
                  <span className="text-[15px] font-semibold text-tinta-suave">{tardeos.length} {tardeos.length === 1 ? "fecha" : "fechas"}</span>
                )}
              </div>
              {tardeos.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center md:p-8">
                  <p className="text-lg font-bold">Sin tardeos próximos</p>
                  <p className="mx-auto mt-1 max-w-md text-[16px] text-tinta-suave">
                    {local.nombre} no tiene fechas publicadas ahora mismo. En cuanto suba una, saldrá aquí.
                  </p>
                  <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                    {instagram && (
                      <EnlaceExterno href={instagram.url} canal="instagram" localId={local.id} className={claseBoton("contorno", "normal")}>
                        <Instagram size={19} className="text-magenta" aria-hidden /> Síguele en Instagram
                      </EnlaceExterno>
                    )}
                    <Link href="/perfil/notificaciones" className={claseBoton("contorno", "normal")}>
                      <Bell size={19} className="text-magenta" aria-hidden /> Activa los avisos
                    </Link>
                  </div>
                  <Link
                    href={local.zona && !esPromotor ? `/tardeos?zona=${encodeURIComponent(local.zona)}` : "/tardeos"}
                    className="mt-3 inline-flex min-h-tacto items-center gap-1 rounded-xl px-2 text-[15px] font-bold text-magenta-700 hover:bg-magenta-50"
                  >
                    {local.zona && !esPromotor ? `Ver otros tardeos en ${local.zona}` : "Ver todos los tardeos"} <ArrowRight size={17} aria-hidden />
                  </Link>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                  {tardeos.map((t) => (
                    <TardeoCard key={t.id} tardeo={t} />
                  ))}
                </div>
              )}
            </section>

            {/* La galería solo si hay más de una foto: la primera ya es la portada. */}
            {fotos.length > 1 && (
              <section>
                <h2 className={`${TITULO} flex items-center gap-2`}>
                  <Images size={22} className="text-magenta" aria-hidden /> Fotos
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">
                  {fotos.map((f, i) => (
                    <a
                      key={f}
                      href={f}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Ver la foto ${i + 1} de ${local.nombre} a tamaño completo`}
                      className={`relative overflow-hidden rounded-xl bg-marfil-200 ${i === 0 ? "col-span-2 row-span-2 aspect-square sm:aspect-auto" : "aspect-square"}`}
                    >
                      <Image src={f} alt="" fill sizes="(max-width: 640px) 50vw, 300px" className="object-cover transition duration-300 hover:scale-105" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            <AdnLocalFicha local={local} />

            {/* Lo que suena en el sitio. Vale igual para promotores. */}
            <Playlist url={local.playlist_url} titulo="Lo que suena aquí" />

            {/* Dónde está: en el móvil, después del contenido; en escritorio
                el mapa sube a la columna lateral. */}
            {conMapa && (
              <section className="lg:hidden">
                <h2 className={TITULO}>Dónde está</h2>
                <Ubicacion local={local} lat={lat} lng={lng} tieneCoords={tieneCoords} urlMapa={urlMapa} />
              </section>
            )}

            {/* Solo si no la lleva nadie. En cuanto la reclamen desaparece. */}
            {local.sinDueno && (
              <ReclamarFicha tipo="local" objetivoId={local.id} nombre={local.nombre} />
            )}

            <Resenas tipo="local" objetivoId={local.id} nombre={local.nombre} className="" />
          </div>

          {/* ── Columna lateral (escritorio) ─────────────────────────────── */}
          {conLateral && <aside className="hidden lg:block">
            <div className="sticky top-24 flex flex-col gap-4">
              {acciones.length > 0 && (
                <div className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
                  <p className="text-[17px] font-bold">Contacto</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {acciones.map((a, i) => (
                      <BotonAccion key={a.href} accion={a} localId={local.id} principal={i === 0} ancho />
                    ))}
                  </div>
                </div>
              )}
              {conMapa && (
                <div className="overflow-hidden rounded-2xl border border-linea bg-white shadow-tarjeta">
                  <Ubicacion local={local} lat={lat} lng={lng} tieneCoords={tieneCoords} urlMapa={urlMapa} lateral />
                </div>
              )}
            </div>
          </aside>}
        </div>
      </div>
    </main>
  );
}

/** Botón de contacto. El primero de la lista es el principal (uno por pantalla). */
function BotonAccion({ accion, localId, principal, ancho }: { accion: Accion; localId: string; principal: boolean; ancho?: boolean }) {
  const Icono = accion.icono;
  return (
    <EnlaceExterno
      href={accion.href}
      canal={accion.canal}
      localId={localId}
      className={claseBoton(principal ? "oro" : "contorno", "normal", true, `${ancho ? "col-span-2" : ""} !text-[16px]`)}
    >
      <Icono size={19} className={principal ? "" : "text-magenta"} aria-hidden /> {accion.label}
    </EnlaceExterno>
  );
}

/** Mapa pequeño + dirección + «Cómo llegar». */
function Ubicacion({
  local, lat, lng, tieneCoords, urlMapa, lateral = false,
}: {
  local: { id: string; direccion?: string | null; zona?: string | null }; lat: number; lng: number; tieneCoords: boolean; urlMapa: string | null; lateral?: boolean;
}) {
  return (
    <div className={lateral ? "" : "mt-4 overflow-hidden rounded-2xl border border-linea bg-white shadow-tarjeta"}>
      {tieneCoords && <MiniMapa lat={lat} lng={lng} alto={lateral ? 200 : 220} />}
      <div className="flex flex-col gap-3 p-4 md:p-5">
        {(local.direccion || local.zona) && (
          <p className="flex items-start gap-2 text-[16px] font-medium">
            <MapPin size={19} className="mt-0.5 shrink-0 text-magenta" aria-hidden />
            <span>
              {local.direccion || local.zona}
              {local.direccion && local.zona && !local.direccion.includes(local.zona) && (
                <span className="block text-[15px] text-tinta-suave">{local.zona}</span>
              )}
            </span>
          </p>
        )}
        {urlMapa && !lateral && (
          <EnlaceExterno href={urlMapa} canal="mapa" localId={local.id} className={claseBoton("contorno", "pequeno", true)}>
            <Navigation size={18} className="text-magenta" aria-hidden /> Abrir en Google Maps
          </EnlaceExterno>
        )}
      </div>
    </div>
  );
}
