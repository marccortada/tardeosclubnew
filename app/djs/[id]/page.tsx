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
import { ArrowLeft, BadgeCheck, Star, Instagram, Youtube, Music2, MessageCircle, FileText, ExternalLink, Download, Bell } from "lucide-react";
import { AvatarDj, estilosDe } from "@/components/DjCard";
import { claseBoton } from "@/components/Boton";
import { tieneValoracion, valoracion } from "@/lib/reputacion";
import ReclamarFicha from "@/components/ReclamarFicha";
import RegistrarVista from "@/components/RegistrarVista";
import { sinMarcas } from "@/lib/texto";

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
  const estilos = estilosDe(dj.estilos);
  const redes = dj.redes && typeof dj.redes === "object" ? dj.redes : {};
  const wa = normalizarRed("whatsapp", redes.whatsapp || "");
  const socials = [
    { k: "instagram", label: "Instagram", icon: Instagram, url: normalizarRed("instagram", redes.instagram || "") },
    { k: "soundcloud", label: "SoundCloud", icon: Music2, url: normalizarRed("soundcloud", redes.soundcloud || "") },
    { k: "youtube", label: "YouTube", icon: Youtube, url: normalizarRed("youtube", redes.youtube || "") },
  ].filter((s) => s.url);

  const presskit: string | null = typeof dj.presskit_url === "string" && dj.presskit_url.startsWith("http") ? dj.presskit_url : null;
  // El atributo `download` no sirve entre dominios: el PDF está en Supabase
  // Storage (público), que fuerza la descarga con `?download=nombre.pdf`.
  const nombrePdf = `PressKit-${String(dj.nombre_artistico || "DJ").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}.pdf`;
  const presskitDescarga = presskit ? `${presskit}${presskit.includes("?") ? "&" : "?"}download=${encodeURIComponent(nombrePdf)}` : null;

  const instagram = socials.find((s) => s.k === "instagram") ?? null;
  const urlContratar = wa
    ? `${wa}?text=${encodeURIComponent(`Hola ${dj.nombre_artistico}, te vi en TardeosClub y me gustaría contratarte para un tardeo.`)}`
    : null;
  const TITULO = "font-display text-[24px] font-bold leading-tight md:text-[30px]";

  // Contratar + redes: arriba en el móvil, en la columna lateral en escritorio.
  const contacto = (lateral: boolean) => (
    <div className={lateral ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2"}>
      {urlContratar && (
        <a href={urlContratar} target="_blank" rel="noopener noreferrer" className={claseBoton("oro", "normal", true, "col-span-2")}>
          <MessageCircle size={20} aria-hidden /> Contratar por WhatsApp
        </a>
      )}
      {socials.map(({ k, label, icon: Ic, url }, i) => (
        <a
          key={k} href={url} target="_blank" rel="noopener noreferrer"
          className={claseBoton("contorno", "normal", true, `!text-[16px] ${!lateral && socials.length % 2 === 1 && i === socials.length - 1 ? "col-span-2" : ""}`)}
        >
          <Ic size={19} className="text-magenta" aria-hidden /> {label}
        </a>
      ))}
    </div>
  );
  const hayContacto = Boolean(urlContratar) || socials.length > 0;
  // Sin nada que poner en la columna lateral, una sola columna centrada: una
  // columna vacía a la derecha hace parecer que falta algo.
  const conLateral = hayContacto || Boolean(presskitDescarga);

  return (
    <main className="pb-16">
      {/* Las redes van ya en URL absoluta: en la base son "@usuario". */}
      <DatosEstructurados datos={jsonLdDj(dj, tardeos, socials.map((s) => s.url))} />
      <RegistrarVista tipo="dj" id={dj.id} />

      {/* ── Cabecera: la misma banda oscura que la ficha de local, con el
          avatar grande (o su degradado con iniciales si no tiene foto). */}
      <header className="relative isolate overflow-hidden bg-tinta text-white">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#141014_0%,#2B0A26_50%,#930E72_100%)]">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-magenta-400/30 blur-3xl" />
          <div className="absolute -bottom-40 right-1/4 h-72 w-72 rounded-full bg-naranja/20 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-3 md:px-8 md:pb-12 md:pt-5">
          <div className="flex items-center justify-between">
            <Link href="/colaboradores?ver=djs" className="-ml-2 inline-flex min-h-tacto items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold text-white/90 transition hover:bg-white/10">
              <ArrowLeft size={20} aria-hidden /> DJs
            </Link>
            <CompartirBtn
              titulo={dj.nombre_artistico}
              texto={`Mira los tardeos de ${dj.nombre_artistico} en TardeosClub`}
              className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 active:scale-95"
            />
          </div>

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-8 md:mt-10">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full shadow-elevada ring-4 ring-white/20 md:h-44 md:w-44">
              <AvatarDj nombre={dj.nombre_artistico} url={dj.avatar_url} sizes="176px" priority textoClase="text-5xl md:text-6xl" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-bold uppercase tracking-wider text-white backdrop-blur">DJ</span>
                {dj.verificado && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-oro px-3 py-1 text-[13px] font-bold text-tinta">
                    <BadgeCheck size={14} aria-hidden /> Verificado
                  </span>
                )}
                {tieneValoracion(dj.reputacion_score) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[13px] font-bold text-white backdrop-blur">
                    <Star size={14} className="text-oro" fill="currentColor" aria-hidden /> {valoracion(dj.reputacion_score)}
                  </span>
                )}
              </div>
              <h1 className="break-words font-display text-[34px] font-bold leading-[1.08] md:text-[54px]">{dj.nombre_artistico}</h1>
              {estilos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Estilos">
                  {estilos.map((e) => (
                    <li key={e} className="rounded-full border border-white/25 px-3 py-1 text-[14px] font-semibold text-white/90">{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 md:px-8">
        {hayContacto && <div className="pt-5 lg:hidden">{contacto(false)}</div>}

        <div className={`grid gap-10 pt-8 lg:gap-12 lg:pt-10 ${conLateral ? "lg:grid-cols-[minmax(0,1fr)_340px]" : "max-w-4xl"}`}>
          <div className="flex min-w-0 flex-col gap-10">
            {dj.bio && (
              <section>
                <h2 className={TITULO}>Sobre {dj.nombre_artistico}</h2>
                <p className="mt-3 max-w-3xl whitespace-pre-line text-[16px] leading-relaxed md:text-[17px]">{sinMarcas(dj.bio)}</p>
              </section>
            )}

            {/* Tardeos del DJ */}
            <section>
              <h2 className={TITULO}>Dónde pincha</h2>
              {tardeos.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center md:p-8">
                  <p className="text-lg font-bold">Sin tardeos próximos</p>
                  <p className="mx-auto mt-1 max-w-md text-[16px] text-tinta-suave">
                    Cuando un local le añada a un tardeo, saldrá aquí.
                  </p>
                  <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                    {instagram && (
                      <a href={instagram.url} target="_blank" rel="noopener noreferrer" className={claseBoton("contorno", "normal")}>
                        <Instagram size={19} className="text-magenta" aria-hidden /> Síguele en Instagram
                      </a>
                    )}
                    <Link href="/perfil/notificaciones" className={claseBoton("contorno", "normal")}>
                      <Bell size={19} className="text-magenta" aria-hidden /> Activa los avisos
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                  {tardeos.map((t) => (
                    <TardeoCard key={t.id} tardeo={t} />
                  ))}
                </div>
              )}
            </section>

            {/* Sus sesiones, vídeos y fotos, antes de las reseñas: es lo que se
                viene a ver de un DJ. */}
            <Playlist url={dj.playlist_url} titulo="Su playlist" />

            <ContenidoPublicoDj djId={dj.id} />

            {/* Press kit: el visor solo en escritorio (en el móvil un PDF
                incrustado no se puede leer); en todos, abrir y descargar. */}
            {presskit && presskitDescarga && (
              <section>
                <h2 className={`${TITULO} flex items-center gap-2`}>
                  <FileText size={24} className="text-magenta" aria-hidden /> Press kit
                </h2>
                <object
                  data={presskit}
                  type="application/pdf"
                  aria-label={`Press kit de ${dj.nombre_artistico}`}
                  className="mt-4 hidden h-[640px] w-full rounded-2xl border border-linea bg-white md:block"
                >
                  <p className="p-4 text-tinta-suave">Tu navegador no puede enseñar el PDF aquí. Ábrelo o descárgalo con los botones.</p>
                </object>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <a href={presskit} target="_blank" rel="noopener noreferrer" className={claseBoton("contorno", "normal")}>
                    <ExternalLink size={18} aria-hidden /> Abrir en pestaña
                  </a>
                  <a href={presskitDescarga} rel="noopener noreferrer" className={claseBoton("contorno", "normal")}>
                    <Download size={18} aria-hidden /> Descargar PDF
                  </a>
                </div>
              </section>
            )}

            {dj.sinDueno && (
              <ReclamarFicha tipo="dj" objetivoId={dj.id} nombre={dj.nombre_artistico} />
            )}

            <Resenas tipo="dj" objetivoId={dj.id} nombre={dj.nombre_artistico} className="" />
          </div>

          {/* ── Columna lateral (escritorio) ─────────────────────────────── */}
          {conLateral && <aside className="hidden lg:block">
            <div className="sticky top-24 flex flex-col gap-4">
              {hayContacto && (
                <div className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
                  <p className="text-[17px] font-bold">{urlContratar ? "Contratar" : "Sus redes"}</p>
                  <div className="mt-3">{contacto(true)}</div>
                </div>
              )}
              {presskitDescarga && (
                <a href={presskitDescarga} rel="noopener noreferrer"
                  className="flex min-h-tacto items-center gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta transition hover:shadow-elevada">
                  <FileText size={22} className="shrink-0 text-magenta" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">Press kit</span>
                    <span className="block text-[14px] text-tinta-suave">Descargar el PDF</span>
                  </span>
                  <Download size={18} className="text-tinta-suave" aria-hidden />
                </a>
              )}
            </div>
          </aside>}
        </div>
      </div>
    </main>
  );
}
