"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import MarcoPerfil from "@/components/musica/MarcoPerfil";
import { AvatarDj, estilosDe } from "@/components/DjCard";
import { BotonSeguir } from "@/components/musica/piezas";
import { supabase } from "@/lib/supabase";
import { faltaLote, MENSAJE_FALTA_LOTE } from "@/lib/sets";

type Fila = { dj_id: string; djs: { id: string; nombre_artistico: string; avatar_url: string | null; estilos: unknown } | null };

/** Mis DJs: los DJs que sigo (dossier pág. 7, "acceso a DJs seguidos desde Perfil"). */
export default function MisDjs() {
  return <MarcoPerfil titulo="Mis DJs" ruta="/perfil/djs">{(uid) => <Lista uid={uid} />}</MarcoPerfil>;
}

function Lista({ uid }: { uid: string }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("seguidores_dj").select("dj_id,djs(id,nombre_artistico,avatar_url,estilos)")
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
        <p className="text-[17px] font-semibold">Aún no sigues a ningún DJ.</p>
        <Link href="/djs" className="mt-4 inline-flex min-h-tacto items-center rounded-xl bg-magenta px-6 font-bold text-white">Descubrir DJs</Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {filas.filter((f) => f.djs).map((f) => (
        <li key={f.dj_id} className="flex items-center gap-3 rounded-2xl border border-linea bg-superficie p-3">
          <Link href={`/djs/${f.dj_id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
              <AvatarDj nombre={f.djs!.nombre_artistico} url={f.djs!.avatar_url} sizes="48px" textoClase="text-base" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold">{f.djs!.nombre_artistico}</p>
              <p className="truncate text-[14px] text-tinta-suave">{estilosDe(f.djs!.estilos).slice(0, 3).join(" / ")}</p>
            </div>
            <ChevronRight size={18} className="ml-auto shrink-0 text-tinta-suave" aria-hidden />
          </Link>
          <BotonSeguir djId={f.dj_id} inicial />
        </li>
      ))}
    </ul>
  );
}
