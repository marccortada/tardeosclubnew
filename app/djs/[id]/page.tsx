import type { Metadata } from "next";
import { getTardeosPublicadosDeDj } from "@/lib/tardeos";
import { getDjPublico } from "@/lib/djs";
import { getSetsDeDj } from "@/lib/sets";
import { estilosDe } from "@/components/DjCard";
import { urlAbsoluta, jsonLdDj } from "@/lib/seo";
import DatosEstructurados from "@/components/DatosEstructurados";
import RegistrarVista from "@/components/RegistrarVista";
import PerfilDj from "./PerfilDj";
import FichaOcultaPropia from "./FichaOcultaPropia";
import ContenidoPublicoDj from "@/components/ContenidoPublicoDj";
import Resenas from "@/components/Resenas";
import ReclamarFicha from "@/components/ReclamarFicha";
import Playlist from "@/components/Playlist";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const dj = await getDjPublico(id);
  // Sin ficha pública (no existe u oculta): que no se indexe esta URL.
  if (!dj) return { title: "DJ no encontrado · TardeosClub", robots: { index: false } };
  const estilos = estilosDe(dj.estilos);
  const desc = `${dj.nombre_artistico}${estilos.length ? ` · ${estilos.join(", ")}` : ""}. Escucha sus sets y mira dónde pincha en TardeosClub.`;
  return {
    title: `${dj.nombre_artistico} · TardeosClub`,
    description: desc,
    alternates: { canonical: urlAbsoluta(`/djs/${id}`) },
    openGraph: { title: dj.nombre_artistico, description: desc, images: dj.avatar_url ? [{ url: dj.avatar_url }] : undefined, url: urlAbsoluta(`/djs/${id}`), type: "website" },
  };
}

/**
 * Perfil del DJ (dossier pág. 7, vídeo 1:40‑2:00): banner, avatar, ciudad ·
 * estilos, Seguir / Mensaje, set destacado y pestañas Sets · Eventos · Sobre mí.
 * `?desde=/tardeos/<id>`: se llegó desde la ficha de un evento y "volver"
 * lleva allí (un evento del line‑up enlaza a esta misma ficha).
 */
export default async function PaginaDj({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ desde?: string; pestana?: string }> }) {
  const { id } = await params;
  const { desde, pestana } = await searchParams;
  const dj = await getDjPublico(id);
  // Solo rutas de evento propias: nada de redirecciones abiertas.
  const volver = typeof desde === "string" && /^\/tardeos\/[\w-]+$/.test(desde) ? desde : null;
  // El servidor lee sin sesión: una ficha oculta no le llega ni a su dueño.
  // El navegador la vuelve a pedir con sesión y, si no es suya, pinta el 404.
  if (!dj) return <FichaOcultaPropia id={id} volver={volver} />;
  const [tardeos, sets] = await Promise.all([getTardeosPublicadosDeDj(id), getSetsDeDj(id)]);
  const redes = dj.redes && typeof dj.redes === "object" ? (dj.redes as Record<string, string>) : {};

  return (
    <>
      <DatosEstructurados datos={jsonLdDj(dj, tardeos, [])} />
      <RegistrarVista tipo="dj" id={dj.id} />
      <PerfilDj
        dj={{
          id: dj.id, nombre: dj.nombre_artistico, bio: dj.bio ?? null, avatar: dj.avatar_url ?? null,
          banner: dj.banner_url ?? null, ciudad: dj.ciudad ?? (Array.isArray(dj.zonas) ? dj.zonas[0] : null) ?? null,
          estilos: estilosDe(dj.estilos), seguidores: Number(dj.seguidores ?? 0), verificado: !!dj.verificado,
          sinDueno: !!dj.sinDueno, playlist: dj.playlist_url ?? null,
          instagram: redes.instagram ?? null,
        }}
        sets={sets.data}
        faltaLote={sets.faltaLote}
        tardeos={tardeos}
        volver={volver}
        pestanaInicial={pestana === "eventos" || pestana === "sobre" ? pestana : "sets"}
        sobreExtra={
          <div className="flex flex-col gap-8">
            <Playlist url={dj.playlist_url} titulo="Su playlist" />
            <ContenidoPublicoDj djId={dj.id} soloImagenes />
            {dj.sinDueno && <ReclamarFicha tipo="dj" objetivoId={dj.id} nombre={dj.nombre_artistico} />}
            <Resenas tipo="dj" objetivoId={dj.id} nombre={dj.nombre_artistico} className="" />
          </div>
        }
      />
    </>
  );
}
