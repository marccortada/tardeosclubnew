"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { getDjPublico } from "@/lib/djs";
import { getSetsDeDj, type SetDj } from "@/lib/sets";
import { getTardeosPublicadosDeDj } from "@/lib/tardeos";
import { estilosDe } from "@/components/DjCard";
import Playlist from "@/components/Playlist";
import type { Tardeo } from "@/lib/types";
import PerfilDj from "./PerfilDj";

type Cargado = {
  dj: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  sets: SetDj[]; faltaLote: boolean; tardeos: Tardeo[];
};

/**
 * Ficha de un DJ que el servidor no ve: o no existe o está oculta.
 *
 * El servidor lee como anónimo (la sesión vive en el navegador), así que una
 * ficha oculta le llega vacía también a su dueño, y «Ver mi ficha» del panel
 * daba 404. Aquí se vuelve a pedir CON la sesión: la política `djs_select`
 * (lote 01) deja ver la fila oculta solo al dueño y al admin. Si la base la
 * devuelve, es suya (o es admin) y se le enseña con un aviso; si no, 404.
 */
export default function FichaOcultaPropia({ id, volver }: { id: string; volver: string | null }) {
  const { user, loading } = useAuth();
  const [estado, setEstado] = useState<"cargando" | "nada" | Cargado>("cargando");

  useEffect(() => {
    if (loading) return;
    if (!user) { setEstado("nada"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    let vivo = true;
    (async () => {
      const dj = await getDjPublico(id);
      if (!vivo) return;
      if (!dj) { setEstado("nada"); return; }
      const [sets, tardeos] = await Promise.all([getSetsDeDj(id), getTardeosPublicadosDeDj(id)]);
      if (vivo) setEstado({ dj, sets: sets.data, faltaLote: sets.faltaLote, tardeos });
    })();
    return () => { vivo = false; };
  }, [id, user, loading]);

  // El título lo puso el servidor («DJ no encontrado»): se corrige al cargarla.
  const nombre = typeof estado === "object" ? String(estado.dj.nombre_artistico ?? "") : "";
  useEffect(() => { if (nombre) document.title = `${nombre} · TardeosClub`; }, [nombre]);

  // Ni dueño ni admin: el mismo 404 en español que cualquier ruta inexistente.
  if (estado === "nada") notFound();

  if (estado === "cargando") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center gap-2 bg-fondo text-[15px] text-tinta-suave" aria-busy>
        <Loader2 size={20} className="animate-spin" aria-hidden /> Cargando ficha…
      </main>
    );
  }

  const { dj, sets, faltaLote, tardeos } = estado;
  const redes = dj.redes && typeof dj.redes === "object" ? (dj.redes as Record<string, string>) : {};
  return (
    <>
      <div role="status" className="mx-auto flex max-w-3xl items-start gap-3 border-b border-aviso/30 bg-aviso-fondo px-4 py-3">
        <EyeOff size={20} className="mt-0.5 shrink-0 text-aviso" aria-hidden />
        <div className="text-[15px]">
          <p className="font-bold text-tinta">Tu ficha aún no es pública</p>
          <p className="text-tinta-suave">
            Solo la ves tú (y el equipo). <Link href="/dj/perfil" className="font-semibold text-magenta-700 underline underline-offset-2">Revisa tu perfil</Link> o escríbenos si crees que ya debería salir.
          </p>
        </div>
      </div>
      <PerfilDj
        dj={{
          id: dj.id, nombre: dj.nombre_artistico, bio: dj.bio ?? null, avatar: dj.avatar_url ?? null,
          banner: dj.banner_url ?? null, ciudad: dj.ciudad ?? (Array.isArray(dj.zonas) ? dj.zonas[0] : null) ?? null,
          estilos: estilosDe(dj.estilos), seguidores: Number(dj.seguidores ?? 0), verificado: !!dj.verificado,
          sinDueno: !!dj.sinDueno, playlist: dj.playlist_url ?? null, instagram: redes.instagram ?? null,
        }}
        sets={sets}
        faltaLote={faltaLote}
        tardeos={tardeos}
        volver={volver}
        pestanaInicial="sets"
        sobreExtra={<Playlist url={dj.playlist_url} titulo="Su playlist" />}
      />
    </>
  );
}
