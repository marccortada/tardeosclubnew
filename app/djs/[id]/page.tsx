import Image from "next/image";
import { getDjById, getTardeosPublicadosDeDj } from "@/lib/tardeos";
import TardeoCard from "@/components/TardeoCard";
import Resenas from "@/components/Resenas";
import ContenidoPublicoDj from "@/components/ContenidoPublicoDj";
import Playlist from "@/components/Playlist";
import CompartirBtn from "@/components/CompartirBtn";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import DatosEstructurados from "@/components/DatosEstructurados";
import { jsonLdDj, urlAbsoluta } from "@/lib/seo";
import { ArrowLeft, BadgeCheck, Star, Music, Disc3, CalendarDays, Instagram, Youtube, Music2, Phone } from "lucide-react";
import { tieneValoracion, valoracion } from "@/lib/reputacion";

export const dynamic = "force-dynamic";

function normalizarRed(tipo: string, v: string): string {
  const s = (v || "").trim();
  if (!s) return "";
  if (tipo === "whatsapp") {
    const num = s.replace(/[^0-9]/g, "");
    return num ? `https://wa.me/${num}` : "";
  }
  if (s.startsWith("http")) return s;
  if (tipo === "instagram") return `https://instagram.com/${s.replace(/^@/, "")}`;
  return `https://${s}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const dj = await getDjById(id);
  if (!dj) return { title: "DJ no encontrado · TardeosClub" };
  const estilos: string[] = Array.isArray(dj.estilos) ? dj.estilos : [];
  const desc = `${dj.nombre_artistico}${estilos.length ? ` · ${estilos.join(", ")}` : ""}. Descubre sus tardeos en TardeosClub.`;
  return {
    title: `${dj.nombre_artistico} · TardeosClub`,
    description: desc,
    alternates: { canonical: urlAbsoluta(`/djs/${id}`) },
    openGraph: {
      title: dj.nombre_artistico,
      description: desc,
      images: dj.avatar_url ? [{ url: dj.avatar_url }] : undefined,
      url: urlAbsoluta(`/djs/${id}`),
      type: "website",
    },
  };
}

export default async function PaginaDj({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dj = await getDjById(id);
  if (!dj) notFound();

  const tardeos = await getTardeosPublicadosDeDj(id);
  const estilos: string[] = Array.isArray(dj.estilos) ? dj.estilos : [];
  const inicial = String(dj.nombre_artistico || "DJ").replace("DJ ", "").charAt(0);
  const redes = dj.redes && typeof dj.redes === "object" ? dj.redes : {};
  const wa = normalizarRed("whatsapp", redes.whatsapp || "");
  const socials = [
    { k: "instagram", icon: Instagram, url: normalizarRed("instagram", redes.instagram || "") },
    { k: "soundcloud", icon: Music2, url: normalizarRed("soundcloud", redes.soundcloud || "") },
    { k: "youtube", icon: Youtube, url: normalizarRed("youtube", redes.youtube || "") },
  ].filter((s) => s.url);

  return (
    <main className="mx-auto max-w-4xl pb-12">
      {/* Las redes van ya en URL absoluta: en la base son "@usuario". */}
      <DatosEstructurados datos={jsonLdDj(dj, tardeos, socials.map((s) => s.url))} />
      {/* Cabecera oscura */}
      <div className="relative overflow-hidden bg-tinta px-4 pb-8 pt-16 text-white md:px-8">
        <span className="bokeh" style={{ width: 160, height: 160, top: -40, right: 20, background: "#E10A5A", opacity: 0.5 }} />
        <Link href="/tardeos" aria-label="Volver" className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25">
          <ArrowLeft size={22} />
        </Link>
        <CompartirBtn
          titulo={dj.nombre_artistico}
          texto={`Mira los tardeos de ${dj.nombre_artistico} en TardeosClub`}
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
        />
        <div className="relative flex items-center gap-4">
          {dj.avatar_url ? (
            <Image src={dj.avatar_url} alt="" width={80} height={80} className="h-20 w-20 rounded-3xl object-cover ring-2 ring-white/20" />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-3xl bg-white/15 font-display text-3xl font-black text-oro">{inicial}</span>
          )}
          <div>
            <h1 className="inline-flex items-center gap-2 font-display text-2xl font-black leading-tight md:text-3xl">
              {dj.nombre_artistico}
              {dj.verificado && <BadgeCheck size={22} className="text-oro-400" />}
            </h1>
            {tieneValoracion(dj.reputacion_score) ? (
              <p className="mt-1 inline-flex items-center gap-1 font-bold text-oro-400">
                <Star size={16} fill="currentColor" /> {valoracion(dj.reputacion_score)} de reputación
              </p>
            ) : (
              <p className="mt-1 inline-flex items-center gap-1 font-bold text-white/70">Nuevo en TardeosClub</p>
            )}
            {socials.length > 0 && (
              <div className="mt-2 flex gap-2">
                {socials.map(({ k, icon: Ic, url }) => (
                  <a key={k} href={url} target="_blank" rel="noopener noreferrer" aria-label={k}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25">
                    <Ic size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8">
        {/* Estilos */}
        {estilos.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {estilos.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 rounded-full bg-magenta-50 px-4 py-2 text-sm font-extrabold text-magenta-700">
                <Music size={14} /> {e}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {dj.bio && (
          <section className="mt-4 rounded-2xl bg-white p-5 shadow-tarjeta ring-1 ring-black/5">
            <p className="font-semibold text-tinta/80">{dj.bio}</p>
          </section>
        )}

        {/* Contratación */}
        {wa && (
          <a
            href={`${wa}?text=${encodeURIComponent(`Hola ${dj.nombre_artistico}, te vi en TardeosClub y me gustaría contratarte para un tardeo.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 text-lg font-extrabold text-white shadow-tarjeta transition hover:brightness-105"
          >
            <Phone size={20} /> Contratar por WhatsApp
          </a>
        )}

        {/* Tardeos del DJ */}
        <section className="mt-7">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-black md:text-2xl">
            <CalendarDays size={22} className="text-magenta" /> Dónde pincha
          </h2>
          {tardeos.length === 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
              <Disc3 size={18} /> Sin tardeos próximos.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              {tardeos.map((t) => (
                <TardeoCard key={t.id} tardeo={t} />
              ))}
            </div>
          )}
        </section>

        {/* Reseñas del DJ */}
        {/* Sus sesiones, vídeos y fotos, antes de las reseñas: es lo que
            se viene a ver de un DJ. */}
        <Playlist url={dj.playlist_url} titulo="Su playlist" />

        <ContenidoPublicoDj djId={dj.id} />

        <Resenas tipo="dj" objetivoId={dj.id} nombre={dj.nombre_artistico} />
      </div>
    </main>
  );
}
