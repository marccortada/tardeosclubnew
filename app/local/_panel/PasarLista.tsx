"use client";

import { useEffect, useState } from "react";
import { Check, X, Loader2, Info, Hourglass } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getInscritosTardeo, marcarAsistencia, type Inscrito } from "@/lib/tardeos";

type Asist = Inscrito["asistencia"];

/**
 * ¿El error es que falta el lote 48? Sin él no existe la función
 * `inscritos_de_tardeo` ni la columna `inscripciones.asistencia` (hoy pasa en
 * producción). Entonces no se enseñan controles que fallarían al pulsarlos.
 */
export const faltaLote48 = (e: string | null) =>
  !!e && /lote 48|asistencia|42703|does not exist|no existe/i.test(e);

/** Alguien en la lista de espera (lote 64), con su puesto en la cola. */
export type EnEspera = { inscripcion_id: string; nombre: string; puesto: number; desde: string };

/**
 * Carga los inscritos de un tardeo para pasar lista o exportar.
 *
 * `filas` son solo los confirmados (a quien se pasa lista y lo que va al CSV).
 * `espera` es la lista de espera: `inscritos_de_tardeo` (lote 48) devuelve
 * todos los estados, también 'espera', pero no `espera_desde`, que es lo que
 * manda en el orden de la cola. Esa fecha se lee aparte de `inscripciones`
 * (la RLS deja al dueño del tardeo leer sus filas). Si esa lectura falla, se
 * ordena por fecha de alta, que casi siempre coincide.
 */
export async function cargarLista(tardeoId: string) {
  const r = await getInscritosTardeo(tardeoId);
  // El tipo de lib/tardeos aún no conoce 'espera' (lote 64): se compara como texto.
  const esperando = r.filas.filter((f) => (f.estado as string) === "espera");
  let espera: EnEspera[] = [];
  if (esperando.length > 0) {
    const { data } = await supabase.from("inscripciones").select("id,espera_desde")
      .eq("tardeo_id", tardeoId).eq("estado", "espera");
    const desde = new Map(((data ?? []) as { id: string; espera_desde: string | null }[]).map((x) => [x.id, x.espera_desde]));
    espera = esperando
      .map((f) => ({ inscripcion_id: f.inscripcion_id, nombre: f.nombre, desde: desde.get(f.inscripcion_id) || f.apuntado_en, puesto: 0 }))
      .sort((a, b) => a.desde.localeCompare(b.desde) || a.inscripcion_id.localeCompare(b.inscripcion_id))
      .map((x, i) => ({ ...x, puesto: i + 1 }));
  }
  return { filas: r.filas.filter((f) => f.estado === "apuntado"), espera, error: r.error, sinLote: faltaLote48(r.error) };
}

/** Bloque «En lista de espera»: solo lectura, en el orden en que subirán. */
export function ListaEspera({ espera }: { espera: EnEspera[] }) {
  if (espera.length === 0) return null;
  return (
    <section aria-label="En lista de espera" className="mt-4">
      <p className="mb-1 flex items-center gap-1.5 text-[15px] font-semibold">
        <Hourglass size={16} className="text-aviso" aria-hidden /> En lista de espera ({espera.length})
      </p>
      <p className="mb-2 text-sm text-tinta-suave">Si alguien se borra, sube solo el primero de la lista y le avisamos.</p>
      <ol className="flex flex-col divide-y divide-linea rounded-xl border border-linea">
        {espera.map((e) => (
          <li key={e.inscripcion_id} className="flex min-h-[44px] items-center gap-3 px-3 py-2">
            <span className="grid h-8 min-w-[32px] shrink-0 place-items-center rounded-full bg-aviso-fondo text-[14px] font-bold text-aviso"
              aria-label={`Puesto ${e.puesto}`}>{e.puesto}</span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{e.nombre}</span>
            <span className="shrink-0 text-sm text-tinta-suave">
              {new Date(e.desde).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
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
  const [espera, setEspera] = useState<EnEspera[]>([]);
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
      setEspera(r.espera);
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
  if (filas.length === 0 && espera.length === 0) return <p className="text-[15px] text-tinta-suave">Todavía no ha dicho «Asistiré» nadie.</p>;

  const vinieron = filas.filter((f) => f.asistencia === "asistio").length;

  return (
    <div>
      <p className="mb-1 text-[15px] text-tinta-suave">
        <b className="text-tinta">{filas.length}</b> {filas.length === 1 ? "confirmado" : "confirmados"}
        {espera.length > 0 && <> · <b className="text-tinta">{espera.length}</b> en espera</>}
      </p>
      {filas.length > 0 && (
        <p className="mb-2 text-[15px] font-semibold" aria-live="polite">
          {vinieron} de {filas.length} vinieron
        </p>
      )}
      {filas.length > 0 && (
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
      )}
      <ListaEspera espera={espera} />
    </div>
  );
}
