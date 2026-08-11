import Image from "next/image";
import { getLocalById, getTardeosPublicadosDeLocal } from "@/lib/tardeos";
import TardeoCard from "@/components/TardeoCard";
import Resenas from "@/components/Resenas";
import CompartirBtn from "@/components/CompartirBtn";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, MapPin, Phone, BadgeCheck, Store, CalendarDays } from "lucide-react";

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
    openGraph: { title: local.nombre, description: desc, images: fotos[0] ? [{ url: fotos[0] }] : undefined, type: "website" },
  };
}

export default async function PaginaLocal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const local = await getLocalById(id);
  if (!local) notFound();

  const tardeos = await getTardeosPublicadosDeLocal(id);
  const fotos: string[] = Array.isArray(local.fotos) ? local.fotos : [];
  const tel = (local.telefono || "").replace(/\s+/g, "");

  return (
    <main className="mx-auto max-w-4xl pb-12">
      {/* Portada */}
      <div className="relative h-44 overflow-hidden bg-marca md:h-60">
        {fotos[0] ? (
          <Image src={fotos[0]} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
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
        <span className="-mt-10 grid h-20 w-20 place-items-center rounded-3xl bg-white text-magenta shadow-tarjeta ring-1 ring-black/5">
          <Store size={38} />
        </span>
        <h1 className="mt-3 flex items-center gap-2 font-display text-2xl font-black leading-tight md:text-3xl">
          {local.nombre}
          {local.verificado && <BadgeCheck size={22} className="shrink-0 text-oro-600" />}
        </h1>
        {local.zona && <p className="text-sm font-bold text-tinta/60">{local.zona}</p>}

        {local.descripcion && <p className="mt-4 font-semibold text-tinta/80">{local.descripcion}</p>}

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
        </div>

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

        {/* Reseñas */}
        <Resenas tipo="local" objetivoId={local.id} nombre={local.nombre} />
      </div>
    </main>
  );
}
