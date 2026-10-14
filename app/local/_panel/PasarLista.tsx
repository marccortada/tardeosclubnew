"use client";

import { useEffect, useState } from "react";
import { Check, X, Loader2, Info } from "lucide-react";
import { getInscritosTardeo, marcarAsistencia, type Inscrito } from "@/lib/tardeos";

type Asist = Inscrito["asistencia"];

/**
 * ¿El error es que falta el lote 48? Sin él no existe la función
 * `inscritos_de_tardeo` ni la columna `inscripciones.asistencia` (hoy pasa en
 * producción). Entonces no se enseñan controles que fallarían al pulsarlos.
 */
export const faltaLote48 = (e: string | null) =>
  !!e && /lote 48|asistencia|42703|does not exist|no existe/i.test(e);

/** Carga los inscritos de un tardeo para pasar lista o exportar. */
export async function cargarLista(tardeoId: string) {
  const r = await getInscritosTardeo(tardeoId);
  return { filas: r.filas.filter((f) => f.estado === "apuntado"), error: r.error, sinLote: faltaLote48(r.error) };
}

const OPCIONES: { v: Asist; label: string; icono?: typeof Check }[] = [
  { v: "asistio", label: "Vino", icono: Check },
  { v: "no_asistio", label: "No vino", icono: X },
  { v: "pendiente", label: "Sin marcar" },
];

/**
 * Pasar lista: quién vino de los que se apuntaron.
 *
 * Cada toque se guarda al momento con `marcar_asistencia` (lote 48), que solo
 * deja al local del tardeo o a un admin. Si falla, se vuelve a lo que había y
 * se dice en la fila, para no dar por marcada una asistencia que no lo está.
 *
 * Sin el lote 48 se enseñan solo los nombres (`nombresRespaldo`, que salen de
 * `inscritos_de_local`) y un aviso discreto.
 */
export default function PasarLista({
  tardeoId, nombresRespaldo = [], onCambio,
}: {
  tardeoId: string;
  nombresRespaldo?: string[];
  /** Avisa al padre (p. ej. para el CSV) de cómo queda la lista. */
  onCambio?: (filas: Inscrito[]) => void;
}) {
  const [filas, setFilas] = useState<Inscrito[] | null>(null);
  const [sinLote, setSinLote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [fallo, setFallo] = useState<{ id: string; t: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarLista(tardeoId).then((r) => {
      if (!vivo) return;
      setSinLote(r.sinLote);
      setError(r.sinLote ? null : r.error);
      setFilas(r.filas);
      onCambio?.(r.filas);
    });
    return () => { vivo = false; };
  }, [tardeoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const marcar = async (f: Inscrito, v: Asist) => {
    if (v === f.asistencia || guardando) return;
    setGuardando(f.inscripcion_id); setFallo(null);
    const { error: e } = await marcarAsistencia(f.inscripcion_id, v);
    setGuardando(null);
    if (e) { setFallo({ id: f.inscripcion_id, t: `No se guardó: ${e.message}` }); return; }
    const nuevas = (filas ?? []).map((x) => (x.inscripcion_id === f.inscripcion_id ? { ...x, asistencia: v } : x));
    setFilas(nuevas);
    onCambio?.(nuevas);
  };

  if (filas === null) {
    return <p className="flex items-center gap-2 text-[15px] text-tinta-suave"><Loader2 size={16} className="animate-spin" aria-hidden /> Cargando la lista…</p>;
  }

  if (sinLote) {
    return (
      <div>
        {nombresRespaldo.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {nombresRespaldo.map((n, i) => <li key={i} className="rounded-full bg-marfil-100 px-3 py-1 text-[15px] font-medium">{n}</li>)}
          </ul>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-tinta-suave">
          <Info size={14} aria-hidden /> Falta pegar el lote 48 para marcar asistencia.
        </p>
      </div>
    );
  }

  if (error) return <p role="alert" className="rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">No se pudo cargar la lista: {error}</p>;
  if (filas.length === 0) return <p className="text-[15px] text-tinta-suave">Todavía no se ha apuntado nadie.</p>;

  const vinieron = filas.filter((f) => f.asistencia === "asistio").length;

  return (
    <div>
      <p className="mb-2 text-[15px] font-semibold" aria-live="polite">
        {vinieron} de {filas.length} vinieron
      </p>
      <ul className="flex flex-col divide-y divide-linea rounded-xl border border-linea">
        {filas.map((f) => (
          <li key={f.inscripcion_id} className="flex flex-col gap-2 p-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
              {f.nombre}
              {guardando === f.inscripcion_id && <Loader2 size={14} className="ml-2 inline animate-spin text-tinta-suave" aria-label="Guardando" />}
            </span>
            <div role="group" aria-label={`Asistencia de ${f.nombre}`} className="flex gap-1">
              {OPCIONES.map(({ v, label, icono: I }) => {
                const on = (f.asistencia ?? "pendiente") === v;
                const tono = v === "asistio" ? "border-ok bg-ok text-white" : v === "no_asistio" ? "border-error bg-error text-white" : "border-tinta bg-tinta text-white";
                return (
                  <button key={v} type="button" aria-pressed={on} disabled={guardando === f.inscripcion_id}
                    onClick={() => marcar(f, v)}
                    className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-lg border px-3 text-[14px] font-semibold transition disabled:opacity-60 sm:flex-none ${
                      on ? tono : "border-linea-fuerte bg-white text-tinta hover:bg-marfil-100"}`}>
                    {I && <I size={15} aria-hidden />} {label}
                  </button>
                );
              })}
            </div>
            {fallo?.id === f.inscripcion_id && <p role="alert" className="text-sm font-semibold text-error sm:basis-full">{fallo.t}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
