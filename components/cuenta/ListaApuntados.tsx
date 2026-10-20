"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hoyISO, cancelarInscripcion, falloPorColumna } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import Paginacion, { usePaginado, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import { Etiqueta } from "@/components/ui/Chip";
import Hoja from "@/components/ui/Hoja";
import Boton, { claseBoton } from "@/components/Boton";
import { CalendarDays, MapPin, X } from "lucide-react";

type Vista = "proximas" | "pasadas" | "canceladas";

type Fila = {
  id: string;
  estado: "apuntado" | "cancelado";
  created_at: string;
  asistencia?: "pendiente" | "asistio" | "no_asistio" | null;
  tardeo: { id: string; titulo: string; fecha: string; hora_inicio: string | null; zona: string | null; locales: { nombre: string | null } | null };
};

/**
 * Los tardeos a los que se ha apuntado, con fecha, estado y "Cancelar".
 * Vive como pestaña "Me he apuntado" de Mis planes (antes era una página
 * aparte, "Mis reservas", y la gente no distinguía una de otra).
 *
 * Paginado en el servidor como el resto de listas, aunque una persona tenga
 * pocas: así no hay sorpresa el día que alguien acumule cien.
 */
export default function ListaApuntados({ user }: { user: { id: string } }) {
  const [vista, setVista] = useState<Vista>("proximas");
  const [cancelar, setCancelar] = useState<Fila | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState("");
  const [ok, setOk] = useState("");

  const uid = user.id;
  const lista = usePaginado<Fila>(async (desde, hasta) => {
    if (!uid) return { data: [], count: 0, error: null };
    const pedir = (conAsistencia: boolean) => {
      let q = supabase
        .from("inscripciones")
        .select(
          `id,estado,created_at${conAsistencia ? ",asistencia" : ""},tardeo:tardeos!inner(id,titulo,fecha,hora_inicio,zona,locales(nombre))`,
          { count: "exact" },
        )
        .eq("profile_id", uid);
      if (vista === "canceladas") q = q.eq("estado", "cancelado");
      else q = q.eq("estado", "apuntado")[vista === "proximas" ? "gte" : "lt"]("tardeo.fecha", hoyISO());
      // Por la fecha del tardeo, ordenado en el servidor (`tardeo(fecha)` ordena
      // las inscripciones por su tardeo; `referencedTable` solo ordenaría el
      // embebido). Así la paginación sale en orden de verdad, no solo dentro de
      // cada página. `id` desempata para que no se repitan filas entre páginas.
      return q.order("tardeo(fecha)", { ascending: vista === "proximas" }).order("id").range(desde, hasta);
    };
    let r = await pedir(true);
    // `asistencia` es del lote 48: si aún no está en la base, se pide sin ella.
    if (r.error && falloPorColumna(r.error, "asistencia")) r = await pedir(false);
    const filas = ((r.data ?? []) as unknown as Fila[]).filter((f) => f.tardeo);
    return { data: filas, count: r.count, error: r.error };
  }, [uid, vista]);

  const confirmarCancelar = async () => {
    if (!cancelar) return;
    setCancelando(true); setErrorCancelar("");
    const { error } = await cancelarInscripcion(user.id, cancelar.tardeo.id);
    setCancelando(false);
    if (error) { setErrorCancelar("No se pudo cancelar tu plaza. Inténtalo otra vez."); return; }
    lista.quitar((f) => f.id === cancelar.id);
    setOk(`Plaza cancelada en «${cancelar.tardeo.titulo}».`);
    setCancelar(null);
  };

  return (
    <div>
      <Filtros<Vista>
        opciones={[
          { clave: "proximas", label: "Próximas" },
          { clave: "pasadas", label: "Pasadas" },
          { clave: "canceladas", label: "Canceladas" },
        ]}
        valor={vista}
        onCambiar={(v) => { setVista(v); setOk(""); }}
      />

      {ok && <p role="status" className="mt-4 rounded-xl bg-ok-fondo px-4 py-3 text-[15px] font-semibold text-ok">{ok}</p>}

      <div className="mt-4">
        <EstadoLista
          cargando={lista.cargando}
          error={lista.error}
          filas={lista.filas.length}
          vacio={vista === "proximas" ? "No tienes plazas para próximos tardeos." : vista === "pasadas" ? "Todavía no hay tardeos pasados aquí." : "No has cancelado ninguna."}
        />
        {!lista.cargando && !lista.error && lista.filas.length === 0 && vista === "proximas" && (
          <div className="mt-3 text-center">
            <Link href="/tardeos" className={claseBoton("primario", "pequeno")}>Buscar tardeos</Link>
          </div>
        )}

        {lista.filas.length > 0 && (
          <ul className="flex flex-col gap-3">
            {lista.filas.map((f) => (
              <li key={f.id} className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta sm:flex-row sm:items-center">
                <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta sm:grid">
                  <CalendarDays size={22} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-magenta-700">
                    {formatFecha(f.tardeo.fecha)}{f.tardeo.hora_inicio ? ` · ${f.tardeo.hora_inicio.slice(0, 5)}` : ""}
                  </p>
                  <Link href={`/tardeos/${f.tardeo.id}`} className="block truncate text-[17px] font-bold hover:text-magenta-700">
                    {f.tardeo.titulo}
                  </Link>
                  {(f.tardeo.locales?.nombre || f.tardeo.zona) && (
                    <p className="flex items-center gap-1 truncate text-[15px] text-tinta-suave">
                      <MapPin size={15} className="shrink-0" aria-hidden /> {[f.tardeo.locales?.nombre, f.tardeo.zona].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {f.estado === "cancelado" ? (
                    <Etiqueta tono="neutro">Cancelada</Etiqueta>
                  ) : f.asistencia === "asistio" ? (
                    <Etiqueta tono="ok">Asististe</Etiqueta>
                  ) : f.asistencia === "no_asistio" ? (
                    <Etiqueta tono="aviso">No asististe</Etiqueta>
                  ) : vista === "pasadas" ? (
                    <Etiqueta tono="neutro">Confirmado</Etiqueta>
                  ) : (
                    <>
                      <Etiqueta tono="ok">Plaza reservada</Etiqueta>
                      <button onClick={() => { setCancelar(f); setErrorCancelar(""); }} className={claseBoton("contorno", "pequeno")}>
                        <X size={18} aria-hidden /> Cancelar
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <Paginacion pagina={lista.pagina} total={lista.total} porPagina={lista.porPagina} onCambiar={lista.setPagina} cargando={lista.cargando} />
        </div>
      </div>

      <Hoja
        abierta={!!cancelar}
        onCerrar={() => setCancelar(null)}
        titulo="¿Cancelar tu plaza?"
        pie={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="contorno" onClick={() => setCancelar(null)}>No, mantenerla</Boton>
            <Boton variante="peligro" onClick={confirmarCancelar} cargando={cancelando}>Sí, cancelar</Boton>
          </div>
        }
      >
        <p className="text-[16px]">
          Dejas libre tu plaza en <b>{cancelar?.tardeo.titulo}</b>
          {cancelar ? ` (${formatFecha(cancelar.tardeo.fecha)})` : ""}. Si cambias de idea, puedes volver a apuntarte mientras queden plazas.
        </p>
        {errorCancelar && <p role="alert" className="mt-3 text-[15px] font-semibold text-error">{errorCancelar}</p>}
      </Hoja>
    </div>
  );
}
