"use client";

import { useState } from "react";
import { Eye, EyeOff, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, EstadoLista } from "@/components/panel/Paginacion";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import { Etiqueta } from "@/components/ui/Chip";

type Resumen = {
  tardeo_id: string; titulo: string; fecha: string; local_id: string | null; local_nombre: string | null; respuestas: number;
  media: number; estrellas: number[]; volverias_si: number; volverias_no: number; volverias_nose: number; total: number;
};
type Respuesta = {
  id: string; valoracion: number; musica: string[]; ambiente: string[]; ropa: string | null; edad_aprox: string | null;
  volverias: string | null; comentario: string | null; comentario_oculto: boolean; created_at: string;
};

/**
 * Encuestas internas (dossier pág. 10 y 15): resultados agregados por tardeo y
 * el detalle de cada respuesta, SOLO para el equipo (la base lo exige). Sirven
 * para ver si la ficha está bien descrita; edad y ropa son percepciones.
 * El equipo puede retirar un comentario de lo público.
 */
export default function AdminEncuestas() {
  const [local, setLocal] = useState<{ id: string; nombre: string } | null>(null);
  const [sel, setSel] = useState<Resumen | null>(null);

  const p = usePaginado<Resumen>(async (desde, hasta) => {
    const { data, error } = await supabase.rpc("resumen_encuestas", { p_local: local?.id ?? null, p_desde: desde, p_limite: hasta - desde + 1 });
    const filas = (data ?? []) as Resumen[];
    return { data: filas, count: filas[0]?.total ?? 0, error };
  }, [local?.id]);

  return (
    <SeccionPanel titulo="Encuestas" ancho="ancho"
      descripcion="«¿Qué tal el tardeo?»: medias, reparto y comentarios. El detalle es solo para el equipo; al público solo llega la nota y el comentario.">
      {local && (
        <div className="mb-3 flex items-center gap-2">
          <Etiqueta tono="marca">Local: {local.nombre}</Etiqueta>
          <button onClick={() => setLocal(null)} className="min-h-[40px] text-sm font-semibold text-magenta">Ver todos</button>
        </div>
      )}
      <EstadoLista cargando={p.cargando} error={p.error ? (/resumen_encuestas|function/.test(p.error) ? "falta el lote 67" : p.error) : null}
        filas={p.filas.length} vacio="Todavía no hay encuestas respondidas." />
      {p.filas.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-linea bg-white">
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-linea bg-marfil text-[13px] font-semibold uppercase tracking-wide text-tinta-suave md:table-header-group">
              <tr><th className="px-4 py-3">Tardeo</th><th className="px-4 py-3">Media</th><th className="px-4 py-3">Reparto</th><th className="px-4 py-3">¿Volverían?</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {p.filas.map((r) => {
                const max = Math.max(1, ...r.estrellas);
                return (
                  <tr key={r.tardeo_id} className="flex flex-col gap-2 p-4 md:table-row md:p-0">
                    <td className="md:px-4 md:py-3">
                      <p className="font-semibold">{r.titulo}</p>
                      <p className="text-sm text-tinta-suave">
                        {new Date(`${r.fecha}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                        {r.local_id ? <button className="font-semibold text-magenta" onClick={() => setLocal({ id: r.local_id!, nombre: r.local_nombre ?? "" })}>{r.local_nombre}</button> : "—"}
                      </p>
                    </td>
                    <td className="md:px-4 md:py-3"><span className="inline-flex items-center gap-1 font-bold"><Star size={16} className="fill-oro text-oro" aria-hidden />{Number(r.media).toFixed(1)}</span> <span className="text-sm text-tinta-suave">({r.respuestas})</span></td>
                    <td className="md:px-4 md:py-3">
                      <div className="flex h-10 items-end gap-1" aria-label={`Reparto: ${r.estrellas.map((n, i) => `${i + 1}★ ${n}`).join(", ")}`}>
                        {r.estrellas.map((n, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div className="w-5 rounded-t bg-magenta" style={{ height: `${Math.max(2, (n / max) * 28)}px` }} />
                            <span className="text-[11px] text-tinta-suave">{i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="text-sm md:px-4 md:py-3">Sí {r.volverias_si} · No {r.volverias_no} · No sé {r.volverias_nose}</td>
                    <td className="md:px-4 md:py-3 md:text-right"><Boton variante="contorno" tamano="pequeno" onClick={() => setSel(r)}>Ver respuestas</Boton></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
      <Hoja abierta={!!sel} onCerrar={() => setSel(null)} titulo={sel ? `Respuestas · ${sel.titulo}` : ""}>
        {sel && <Detalle tardeo={sel.tardeo_id} />}
      </Hoja>
    </SeccionPanel>
  );
}

function Detalle({ tardeo }: { tardeo: string }) {
  const p = usePaginado<Respuesta>((d, h) =>
    supabase.from("encuestas").select("id,valoracion,musica,ambiente,ropa,edad_aprox,volverias,comentario,comentario_oculto,created_at", { count: "exact" })
      .eq("tardeo_id", tardeo).order("created_at", { ascending: false }).order("id").range(d, h), [tardeo], 15);
  const ocultar = async (r: Respuesta) => {
    const v = !r.comentario_oculto;
    const { data } = await supabase.from("encuestas").update({ comentario_oculto: v }).eq("id", r.id).select("id");
    if (data?.length) {
      p.cambiar((x) => x.id === r.id, { comentario_oculto: v });
      await supabase.rpc("auditar", { p_accion: v ? "ocultar_comentario" : "mostrar_comentario", p_entidad: "encuesta", p_entidad_id: r.id });
    }
  };
  const VOL: Record<string, string> = { si: "Volvería", no: "No volvería", nose: "No lo sabe" };
  return (
    <div className="flex flex-col gap-2">
      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length} vacio="Sin respuestas." />
      {p.filas.map((r) => (
        <div key={r.id} className="rounded-xl border border-linea p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">{"★".repeat(r.valoracion)}<span className="text-linea-fuerte">{"★".repeat(5 - r.valoracion)}</span></span>
            <span className="text-sm text-tinta-suave">{new Date(r.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
          <p className="mt-1 text-sm text-tinta-suave">
            {[r.musica.join(", "), r.ambiente.join(", "), r.ropa, r.edad_aprox, r.volverias ? VOL[r.volverias] : null].filter(Boolean).join(" · ") || "Sin detalles"}
          </p>
          {r.comentario && (
            <div className="mt-2 flex items-start justify-between gap-2">
              <p className={`text-[15px] ${r.comentario_oculto ? "text-tinta-suave line-through" : ""}`}>{r.comentario}</p>
              <button onClick={() => ocultar(r)} aria-label={r.comentario_oculto ? "Volver a mostrar" : "Ocultar del público"}
                className="grid min-h-[40px] min-w-[40px] shrink-0 place-items-center rounded-lg border border-linea-fuerte hover:bg-marfil-100">
                {r.comentario_oculto ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
              </button>
            </div>
          )}
        </div>
      ))}
      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
    </div>
  );
}
