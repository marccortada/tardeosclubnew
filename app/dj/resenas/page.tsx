"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, EstadoLista } from "@/components/panel/Paginacion";
import { claseBoton } from "@/components/Boton";
import { supabase } from "@/lib/supabase";
import { tieneValoracion, valoracion } from "@/lib/reputacion";
import { useDj } from "../contexto";

type FilaResena = {
  id: string;
  puntuacion: number;
  comentario: string | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

/**
 * Lo que la gente opina del DJ. Solo las aprobadas: son las que salen en su
 * ficha pública, y la RLS de `resenas` no le deja ver las pendientes de otros
 * (la moderación la hace el admin). Paginado en el servidor.
 */
export default function ResenasDj() {
  const { dj, ruta } = useDj();

  const p = usePaginado<FilaResena>(
    (desde, hasta) =>
      supabase
        .from("resenas")
        .select("id,puntuacion,comentario,created_at,profiles:autor_profile_id(display_name)", { count: "exact" })
        .eq("objetivo_tipo", "dj")
        .eq("objetivo_id", dj.id)
        .eq("estado", "aprobada")
        .order("created_at", { ascending: false })
        .order("id")
        .range(desde, hasta) as unknown as PromiseLike<{ data: FilaResena[] | null; count: number | null; error: unknown }>,
    [dj.id],
    10,
  );

  return (
    <SeccionPanel titulo="Reseñas" descripcion="Lo que opina la gente que te ha escuchado. Son las mismas que se ven en tu ficha pública." ancho="estrecho">
      <section className="mb-4 flex items-center gap-4 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-oro-400/20 text-oro-600">
          <Star size={26} fill="currentColor" aria-hidden />
        </span>
        <div>
          <p className="text-2xl font-bold leading-none">
            {tieneValoracion(dj.reputacion_score) ? valoracion(dj.reputacion_score) : "—"}
          </p>
          <p className="mt-1 text-[15px] text-tinta-suave">
            {p.cargando && p.total === 0 ? "Contando reseñas…" : `${p.total} ${p.total === 1 ? "reseña publicada" : "reseñas publicadas"}`}
          </p>
        </div>
      </section>

      <EstadoLista
        cargando={p.cargando}
        error={p.error}
        filas={p.filas.length}
        vacio="Aún no tienes reseñas. Comparte tu ficha después de pinchar: quien te ha escuchado puede valorarte desde ella."
      />
      {!p.cargando && !p.error && p.filas.length === 0 && (
        <Link href={`/djs/${dj.id}`} className={claseBoton("contorno", "pequeno", false, "mt-3")}>Ver mi ficha pública</Link>
      )}

      {p.filas.length > 0 && (
        <ul className={`flex flex-col gap-2 ${p.cargando ? "opacity-60" : ""}`}>
          {p.filas.map((r) => (
            <li key={r.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-0.5 text-oro-600" aria-label={`${r.puntuacion} de 5 estrellas`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={18} fill={n <= r.puntuacion ? "currentColor" : "none"} aria-hidden />
                  ))}
                </span>
                <span className="text-sm text-tinta-suave">
                  {new Date(r.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              {r.comentario ? (
                <p className="mt-2 whitespace-pre-line text-[15px] text-tinta">{r.comentario}</p>
              ) : (
                <p className="mt-2 text-[15px] text-tinta-suave">Sin comentario, solo puntuación.</p>
              )}
              <p className="mt-2 text-sm font-semibold text-tinta-suave">{r.profiles?.display_name || "Tardícola"}</p>
            </li>
          ))}
        </ul>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <p className="mt-6 text-[15px] text-tinta-suave">
        ¿Ves una reseña falsa o con insultos? Escríbenos desde <Link href={ruta("/dj/ayuda")} className="font-semibold text-magenta-700 underline underline-offset-2">Ayuda</Link> y la revisamos.
      </p>
    </SeccionPanel>
  );
}
