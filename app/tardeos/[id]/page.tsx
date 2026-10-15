import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatFecha, flyerSrc } from "@/lib/formato";
import { getTardeoById, getTardeosPublicadosDeLocal } from "@/lib/tardeos";
import { precioCorto } from "@/lib/tardicola";
import AccionTardeo from "@/components/AccionTardeo";
import Resenas from "@/components/Resenas";
import CompartirBtn from "@/components/CompartirBtn";
import RegistrarVista from "@/components/RegistrarVista";
import DestacarTardeo from "@/components/DestacarTardeo";
import EnlaceExterno from "@/components/EnlaceExterno";
import DenunciarFlyer from "@/components/DenunciarFlyer";
import DatosEstructurados from "@/components/DatosEstructurados";
import TarjetaPlan from "@/components/tardicola/TarjetaPlan";
import { AfinAMi, LeerMas } from "@/components/tardicola/FichaPiezas";
import { jsonLdEvento, urlAbsoluta } from "@/lib/seo";
import { getPromosDeTardeo } from "@/lib/promociones";
import { sinMarcas } from "@/lib/texto";
import { hoyEnEspana } from "@/lib/fechas";
import type { Tardeo } from "@/lib/types";
import { ArrowLeft, CalendarDays, MapPin, Navigation, Tag, Ban, History, Star, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tardeo = await getTardeoById(id);
  if (!tardeo) return { title: "Tardeo no encontrado · TardeosClub" };
  const desc = `${formatFecha(tardeo.fecha)} · ${tardeo.local.nombre} (${tardeo.zona})${tardeo.estilo ? ` · ${tardeo.estilo}` : ""}. Descúbrelo en TardeosClub.`;
  const img = flyerSrc(tardeo);
  return {
    title: `${tardeo.titulo} · TardeosClub`,
    description: desc,
    // Sin esto heredaría la canónica del listado (app/tardeos/layout.tsx).
    alternates: { canonical: urlAbsoluta(`/tardeos/${id}`) },
    openGraph: { title: tardeo.titulo, description: desc, images: [{ url: img }], url: urlAbsoluta(`/tardeos/${id}`), type: "website" },
    twitter: { card: "summary_large_image", title: tardeo.titulo, description: desc, images: [img] },
  };
}

/** "Sábado 24 octubre · 17:00–22:00" */
function cuando(t: Tardeo) {
  const hora = t.horaInicio ? ` · ${t.horaInicio}${t.horaFin ? `–${t.horaFin}` : ""}` : "";
  return `${formatFecha(t.fecha)}${hora}`;
}

/** Entrada y condiciones: lo que de verdad se sabe, sin inventar. */
function condiciones(t: Tardeo): string {
  const partes: string[] = [];
  if (t.tipoEntrada === "gratis") partes.push("Entrada gratuita");
  else if (t.tipoEntrada === "lista") partes.push("Con lista de acceso");
  else partes.push(t.precio != null ? `Entrada ${t.precio} €` : "De pago: precio en la web del evento o en el local");
  if (t.urlEntradas) partes.push("Presenta tu entrada al acceder al evento");
  if (t.horaInicio) partes.push(`Acceso desde las ${t.horaInicio}`);
  if (t.dressCode) partes.push(`Dress code: ${t.dressCode}`);
  if (t.publico?.length) partes.push(`Público ${t.publico.join(", ")}`);
  if (t.etiquetas?.length) partes.push(t.etiquetas.join(" · "));
  return partes.join(" · ");
}

/**
 * Ficha del tardeo (dossier pág. 5, vídeo 0:55). Portada, datos, Cómo llegar,
 * precio, Afín a mí, descripción con Leer más, Entrada y condiciones, Line‑up,
 * Quiénes van, Meet Zone y acciones. Pedir taxi: aplazado, quitado.
 */
export default async function FichaTardeo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tardeo = await getTardeoById(id);
  if (!tardeo) notFound();

  const cancelado = tardeo.estado === "cancelado";
  const pasado = tardeo.fecha < hoyEnEspana();
  const activo = !pasado && !cancelado;

  const [promos, delLocal] = await Promise.all([
    activo ? getPromosDeTardeo(id) : Promise.resolve([]),
    tardeo.local.nombre ? getTardeosPublicadosDeLocal(tardeo.local.id) : Promise.resolve([] as Tardeo[]),
  ]);
  const otros = delLocal.filter((t) => t.id !== tardeo.id).slice(0, 4);
  const flyer = flyerSrc(tardeo);
  const textoCompartir = `¡Mira este tardeo! ${tardeo.titulo} — ${formatFecha(tardeo.fecha)} en ${tardeo.local.nombre}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tardeo.local.direccion || `${tardeo.lat},${tardeo.lng}`)}`;
  const descripcion = tardeo.descripcion ? sinMarcas(tardeo.descripcion) : "";

  return (
    <main className="bg-fondo">
      <DatosEstructurados datos={jsonLdEvento(tardeo)} />
      <RegistrarVista tipo="tardeo" id={tardeo.id} />

      <div className="mx-auto max-w-3xl md:px-8 md:pt-8">
        {/* Portada */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-marfil-100 md:rounded-3xl">
          <Image src={flyer} alt={`Cartel de ${tardeo.titulo}`} fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
          {/* Volver con historial: conserva filtros, vista y posición de Eventos. */}
          <Link href="/eventos" aria-label="Volver a Eventos"
            className="absolute left-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
            <ArrowLeft size={22} aria-hidden />
          </Link>
          <CompartirBtn titulo={tardeo.titulo} texto={textoCompartir}
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur" />
          {tardeo.destacado && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-oro px-3 py-1 text-[13px] font-bold text-[#1A1A1A]">
              <Star size={13} fill="currentColor" aria-hidden /> Destacado
            </span>
          )}
        </div>

        <div className="flex flex-col gap-6 px-4 pt-5">
          <div>
            <h1 className="text-[30px] font-bold leading-tight text-tinta md:text-[40px]">{tardeo.titulo}</h1>
            <p className="mt-2 flex items-center gap-2 text-[16px] text-tinta"><CalendarDays size={18} className="text-magenta" aria-hidden /> {cuando(tardeo)}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-[16px] text-tinta-suave">
                <MapPin size={18} className="shrink-0 text-magenta" aria-hidden />
                {tardeo.local.nombre ? (
                  <Link href={`/locales/${tardeo.local.id}`} className="flex min-h-[44px] min-w-0 items-center hover:underline"><span className="truncate">{[tardeo.local.nombre, tardeo.zona].filter(Boolean).join(" · ")}</span></Link>
                ) : <span className="truncate">{tardeo.zona || "Por confirmar"}</span>}
              </p>
              <EnlaceExterno href={mapsUrl} canal="mapa" localId={tardeo.local.id} tardeoId={tardeo.id}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-linea-fuerte bg-superficie px-3 text-[14px] font-semibold text-tinta">
                <Navigation size={15} aria-hidden /> Cómo llegar
              </EnlaceExterno>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-oro px-2.5 py-1 text-[15px] font-bold text-[#1A1A1A]">{precioCorto(tardeo)}</span>
              <AfinAMi tardeo={tardeo} />
            </div>
          </div>

          {!activo && (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-aviso/30 bg-aviso-fondo p-4">
              {cancelado ? <Ban size={22} className="mt-0.5 shrink-0 text-aviso" aria-hidden /> : <History size={22} className="mt-0.5 shrink-0 text-aviso" aria-hidden />}
              <div>
                <p className="text-[17px] font-bold text-tinta">{cancelado ? "Este tardeo se ha cancelado" : "Este tardeo ya pasó"}</p>
                {pasado && !cancelado && (
                  <Link href={`/tardeos/${tardeo.id}/encuesta`} className="mt-1 inline-flex min-h-[44px] items-center gap-1 font-semibold text-magenta-700">
                    ¿Qué tal el tardeo? Cuéntanoslo <ArrowRight size={16} aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          )}

          {descripcion && <LeerMas texto={descripcion} />}

          <section className="rounded-3xl border border-linea bg-superficie p-4">
            <h2 className="text-[17px] font-bold text-tinta">Entrada y condiciones</h2>
            <p className="mt-1 text-[15px] text-tinta-suave">{condiciones(tardeo)}</p>
          </section>

          {activo && (tardeo.promoTitulo || promos.length > 0) && (
            <section className="flex flex-col gap-2">
              {tardeo.promoTitulo && (
                <div className="rounded-2xl border border-oro bg-oro/15 p-4">
                  <p className="flex items-center gap-2 font-bold text-tinta"><Tag size={17} aria-hidden /> {tardeo.promoTitulo}</p>
                  {tardeo.promoTexto && <p className="mt-1 text-tinta-suave">{tardeo.promoTexto}</p>}
                </div>
              )}
              {promos.map((p) => (
                <div key={p.id} className="rounded-2xl border border-oro bg-oro/15 p-4">
                  <p className="flex items-center gap-2 font-bold text-tinta"><Tag size={17} aria-hidden /> {p.nombre}</p>
                  {p.beneficio && <p className="mt-1 text-tinta-suave">{p.beneficio}</p>}
                  {p.codigo && <p className="mt-2 text-[15px] text-tinta-suave">Código <span className="rounded-lg bg-tinta px-2 py-1 font-mono font-bold text-fondo">{p.codigo}</span></p>}
                </div>
              ))}
            </section>
          )}

          {tardeo.djs.length > 0 && (
            <section>
              <h2 className="text-[22px] font-bold text-tinta">Line‑up</h2>
              <div className="mt-3 flex gap-5 overflow-x-auto pb-1">
                {tardeo.djs.map((dj) => (
                  <Link key={dj.id} href={`/djs/${dj.id}?desde=${tardeo.id}`} className="flex w-[84px] shrink-0 flex-col items-center gap-1.5 text-center">
                    {dj.avatar ? (
                      <Image src={dj.avatar} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full object-cover" />
                    ) : (
                      <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-magenta-100 text-2xl font-bold text-magenta-700">{dj.nombre.replace("DJ ", "").charAt(0)}</span>
                    )}
                    <span className="line-clamp-2 text-[14px] font-semibold text-tinta">{dj.nombre}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <AccionTardeo tardeo={tardeo} activo={activo} />

          <DestacarTardeo localId={tardeo.local.id} tardeoId={tardeo.id} titulo={tardeo.titulo} />
          <Resenas tipo="local" objetivoId={tardeo.local.id} nombre={tardeo.local.nombre} />
          <DenunciarFlyer tardeoId={tardeo.id} flyerUrl={flyer} />

          {otros.length > 0 && (
            <section>
              <h2 className="mb-3 text-[22px] font-bold text-tinta">Más de {tardeo.local.nombre}</h2>
              <div className="grid gap-4 sm:grid-cols-2">{otros.map((t) => <TarjetaPlan key={t.id} t={t} />)}</div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
