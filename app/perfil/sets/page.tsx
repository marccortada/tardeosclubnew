"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import MarcoPerfil from "@/components/musica/MarcoPerfil";
import { BotonPlay } from "@/components/musica/piezas";
import { supabase } from "@/lib/supabase";
import { faltaLote, guardarSet, portadaDe, MENSAJE_FALTA_LOTE, type Plataforma } from "@/lib/sets";

type Fila = {
  set_id: string;
  sets: { id: string; titulo: string; url: string; plataforma: Plataforma; portada: string | null; dj_id: string; djs: { nombre_artistico: string } | null } | null;
};

/**
 * Mis sets: los sets guardados (no confundir con guardar plan, que es
 * Próxima Parada). Se escuchan aquí mismo con el reproductor global.
 */
export default function MisSets() {
  return <MarcoPerfil titulo="Mis sets" ruta="/perfil/sets">{(uid) => <Lista uid={uid} />}</MarcoPerfil>;
}

function Lista({ uid }: { uid: string }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("sets_guardados")
      .select("set_id,sets(id,titulo,url,plataforma,portada,dj_id,djs(nombre_artistico))")
      .eq("profile_id", uid).order("created_at", { ascending: false }).limit(200)
      .then(({ data, error }) => {
        if (error) { setError(faltaLote(error) ? MENSAJE_FALTA_LOTE : error.message); setFilas([]); return; }
        setFilas((data ?? []) as unknown as Fila[]);
      });
  }, [uid]);

  if (filas === null) return <p className="text-tinta-suave">Cargando…</p>;
  if (error) return <p className="rounded-xl bg-aviso-fondo p-3 text-[15px] text-aviso">{error}</p>;
  if (!filas.length) {
    return (
      <div className="pt-8 text-center">
        <p className="text-[17px] font-semibold">Aún no has guardado ningún set.</p>
        <p className="mt-1 text-[15px] text-tinta-suave">Pulsa el marcador de un set para tenerlo aquí.</p>
        <Link href="/djs" className="mt-4 inline-flex min-h-tacto items-center rounded-xl bg-magenta px-6 font-bold text-white">Descubrir sets</Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {filas.filter((f) => f.sets).map((f) => {
        const s = f.sets!;
        const autor = s.djs?.nombre_artistico ?? "";
        const portada = portadaDe(s);
        return (
          <li key={f.set_id} className="flex items-center gap-3 rounded-2xl border border-linea bg-superficie p-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#2B0A26,#D61AA8)]">
              {portada && <Image src={portada} alt="" fill sizes="48px" unoptimized className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold">{s.titulo}</p>
              <Link href={`/djs/${s.dj_id}`} className="truncate text-[14px] text-tinta-suave">{autor}</Link>
            </div>
            <button type="button" aria-label="Quitar de mis sets"
              onClick={async () => { const e = await guardarSet(s.id, uid, false); if (!e) setFilas((xs) => (xs ?? []).filter((x) => x.set_id !== s.id)); }}
              className="grid h-11 w-11 place-items-center rounded-full text-magenta">
              <Bookmark size={20} className="fill-magenta" aria-hidden />
            </button>
            <BotonPlay set={s} autor={autor} className="border-2 border-magenta text-magenta" />
          </li>
        );
      })}
    </ul>
  );
}
