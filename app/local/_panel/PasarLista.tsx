"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X, Loader2, Info, Hourglass, Search, UserPlus, Undo2, ArrowDownToLine, Ban } from "lucide-react";
import {
  getListaTardeo, getPlazasTardeo, marcarAsistencia, moverInscripcion, promoverSiguiente,
  type FilaLista, type Inscrito,
} from "@/lib/tardeos";

type Asist = Inscrito["asistencia"];

/**
 * ¿El error es que falta el lote 48? Sin él no existe la función
 * `inscritos_de_tardeo` ni la columna `inscripciones.asistencia`.
 * Entonces no se enseñan controles que fallarían al pulsarlos.
 */
export const faltaLote48 = (e: string | null) =>
  !!e && /lote 48|asistencia|42703|does not exist|no existe/i.test(e);

/** Alguien en la lista de espera, con su puesto en la cola. */
export type EnEspera = { inscripcion_id: string; nombre: string; puesto: number; desde: string };

/**
 * Carga los inscritos de un tardeo para exportar (lo usa el CSV de
 * /local/apuntados). `filas` = confirmados; `espera` = la cola en orden.
 */
export async function cargarLista(tardeoId: string) {
  const r = await getListaTardeo(tardeoId);
  const espera: EnEspera[] = r.filas.filter((f) => f.estado === "espera")
    .sort((a, b) => (a.puesto ?? 0) - (b.puesto ?? 0))
    .map((f) => ({ inscripcion_id: f.inscripcion_id, nombre: f.nombre, puesto: f.puesto ?? 0, desde: f.espera_desde ?? f.apuntado_en }));
  return { filas: r.filas.filter((f) => f.estado === "apuntado") as Inscrito[], espera, error: r.error, sinLote: faltaLote48(r.error) };
}

const OPCIONES: { v: Asist; label: string; icono?: typeof Check }[] = [
  { v: "asistio", label: "Vino", icono: Check },
  { v: "no_asistio", label: "No vino", icono: X },
  { v: "pendiente", label: "Sin marcar" },
];

type Vista = "confirmados" | "por_marcar" | "vinieron" | "no_vinieron" | "espera" | "cancelados" | "todos";
const POR_TANDA = 50;

/**
 * Asistentes de UN tardeo: pasar lista y gestionar la lista de espera.
 *
 * Por qué así: antes aquí solo se podía marcar «Vino / No vino» y la espera era
 * de solo lectura; dar plaza o cancelar a alguien solo se podía desde
 * /admin/registro, que no se podía filtrar por tardeo. Ahora todo lo de un
 * tardeo se hace en su ficha, la del local y la del admin:
 *  - Resumen arriba (confirmados / aforo, en espera, vinieron, cancelados).
 *  - Buscador y filtros: con 200 apuntados, encontrar a alguien en la puerta
 *    tiene que ser escribir dos letras.
 *  - Acciones por persona: dar plaza, pasar a espera, cancelar, volver a
 *    confirmar. Las protege la base (lote 75: admin de la zona o dueño del
 *    local; el aforo se respeta y cada cambio queda en la auditoría).
 *  - Se pinta por tandas de 50 para que el móvil no se arrastre.
 *
 * Cada toque se guarda al momento. Si falla, no se cambia nada en pantalla y
 * se dice en la fila, para no dar por hecho algo que no lo está.
 */
export default function PasarLista({
  tardeoId, nombresRespaldo = [], onCambio,
}: {
  tardeoId: string;
  nombresRespaldo?: string[];
  /** Avisa al padre (p. ej. para el CSV) de cómo quedan los confirmados. */
  onCambio?: (filas: Inscrito[]) => void;
}) {
  const [filas, setFilas] = useState<FilaLista[] | null>(null);
  const [aforo, setAforo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sinLote, setSinLote] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ id: string; t: string; ok?: boolean } | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("confirmados");
  const [q, setQ] = useState("");
  const [cuantos, setCuantos] = useState(POR_TANDA);

  const cargar = useCallback(async () => {
    const [r, p] = await Promise.all([getListaTardeo(tardeoId), getPlazasTardeo(tardeoId)]);
    setSinLote(faltaLote48(r.error));
    setError(faltaLote48(r.error) ? null : r.error);
    setFilas(r.filas);
    setAforo(p?.aforo ?? null);
    onCambio?.(r.filas.filter((f) => f.estado === "apuntado"));
  }, [tardeoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar(); }, [cargar]);

  const n = useMemo(() => {
    const f = filas ?? [];
    const conf = f.filter((x) => x.estado === "apuntado");
    return {
      confirmados: conf.length,
      por_marcar: conf.filter((x) => x.asistencia === "pendiente").length,
      vinieron: conf.filter((x) => x.asistencia === "asistio").length,
      no_vinieron: conf.filter((x) => x.asistencia === "no_asistio").length,
      espera: f.filter((x) => x.estado === "espera").length,
      cancelados: f.filter((x) => x.estado === "cancelado").length,
      todos: f.length,
    };
  }, [filas]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return (filas ?? []).filter((f) => {
      const pasa =
        vista === "todos" ? true
        : vista === "confirmados" ? f.estado === "apuntado"
        : vista === "por_marcar" ? f.estado === "apuntado" && f.asistencia === "pendiente"
        : vista === "vinieron" ? f.estado === "apuntado" && f.asistencia === "asistio"
        : vista === "no_vinieron" ? f.estado === "apuntado" && f.asistencia === "no_asistio"
        : vista === "espera" ? f.estado === "espera"
        : f.estado === "cancelado";
      if (!pasa) return false;
      if (!t) return true;
      return `${f.nombre} ${f.email ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t);
    }).sort((a, b) => (a.estado === "espera" && b.estado === "espera" ? (a.puesto ?? 0) - (b.puesto ?? 0) : 0));
  }, [filas, vista, q]);

  // Al cambiar de filtro o de búsqueda se vuelve a la primera tanda.
  useEffect(() => { setCuantos(POR_TANDA); }, [vista, q]);

  const marcar = async (f: FilaLista, v: Asist) => {
    if (v === f.asistencia || guardando) return;
    setGuardando(f.inscripcion_id); setAviso(null);
    const { error: e } = await marcarAsistencia(f.inscripcion_id, v);
    setGuardando(null);
    if (e) { setAviso({ id: f.inscripcion_id, t: `No se guardó: ${e.message}` }); return; }
    const nuevas = (filas ?? []).map((x) => (x.inscripcion_id === f.inscripcion_id ? { ...x, asistencia: v } : x));
    setFilas(nuevas);
    onCambio?.(nuevas.filter((x) => x.estado === "apuntado"));
  };

  // Cambiar de estado mueve la cola (subidas automáticas, puestos): se recarga
  // la lista entera en vez de adivinar cómo queda.
  const mover = async (f: FilaLista, estado: "apuntado" | "espera" | "cancelado") => {
    if (guardando) return;
    setGuardando(f.inscripcion_id); setAviso(null); setConfirmar(null);
    const { error: e } = await moverInscripcion(f.inscripcion_id, estado);
    setGuardando(null);
    if (e) { setAviso({ id: f.inscripcion_id, t: e }); return; }
    await cargar();
    setAviso({ id: "general", ok: true, t:
      estado === "apuntado" ? `${f.nombre} ya tiene plaza. Le hemos avisado.`
      : estado === "espera" ? `${f.nombre} pasa a la lista de espera.`
      : `Plaza de ${f.nombre} cancelada.${n.espera > 0 && f.estado === "apuntado" ? " Si había alguien esperando, ha subido solo y le hemos avisado." : ""}` });
  };

  const siguiente = async () => {
    if (guardando) return;
    setGuardando("siguiente"); setAviso(null);
    const r = await promoverSiguiente(tardeoId);
    setGuardando(null);
    if (r.error) { setAviso({ id: "general", t: r.error }); return; }
    await cargar();
    setAviso({ id: "general", ok: true, t: r.nadie ? "No hay nadie en la lista de espera." : "Hemos dado plaza al primero de la espera y le hemos avisado." });
  };

  if (filas === null) {
    return <p className="flex items-center gap-2 text-[15px] text-tinta-suave"><Loader2 size={16} className="animate-spin" aria-hidden /> Cargando la lista…</p>;
  }

  if (sinLote) {
    return (
      <div>
        {nombresRespaldo.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {nombresRespaldo.map((x, i) => <li key={i} className="rounded-full bg-marfil-100 px-3 py-1 text-[15px] font-medium">{x}</li>)}
          </ul>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-tinta-suave">
          <Info size={14} aria-hidden /> Falta pegar el lote 48 para marcar asistencia.
        </p>
      </div>
    );
  }

  if (error) return <p role="alert" className="rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">No se pudo cargar la lista: {error}</p>;
  if (filas.length === 0) return <p className="text-[15px] text-tinta-suave">Todavía no ha dicho «Asistiré» nadie.</p>;

  const libres = aforo == null ? null : Math.max(0, aforo - n.confirmados);
  const pestañas: { k: Vista; label: string; c: number }[] = [
    { k: "confirmados", label: "Confirmados", c: n.confirmados },
    { k: "por_marcar", label: "Por marcar", c: n.por_marcar },
    { k: "vinieron", label: "Vinieron", c: n.vinieron },
    { k: "no_vinieron", label: "No vinieron", c: n.no_vinieron },
    { k: "espera", label: "En espera", c: n.espera },
    { k: "cancelados", label: "Cancelados", c: n.cancelados },
    { k: "todos", label: "Todos", c: n.todos },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Resumen: lo que el local mira de un vistazo en la puerta. */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Dato t="Confirmados" v={aforo == null ? `${n.confirmados}` : `${n.confirmados} / ${aforo}`} pie={libres == null ? "Sin aforo" : libres === 0 ? "Completo" : `${libres} libres`} />
        <Dato t="En espera" v={`${n.espera}`} pie={n.espera ? "Suben solos al liberarse plaza" : "Nadie esperando"} />
        <Dato t="Vinieron" v={`${n.vinieron}`} pie={n.confirmados ? `de ${n.confirmados}` : "—"} />
        <Dato t="Cancelados" v={`${n.cancelados}`} />
      </dl>

      {n.espera > 0 && (
        <button type="button" onClick={siguiente} disabled={!!guardando}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-magenta px-4 text-[15px] font-bold text-white disabled:opacity-60 sm:self-start">
          {guardando === "siguiente" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <UserPlus size={18} aria-hidden />}
          Dar plaza al siguiente de la espera
        </button>
      )}
      {aviso?.id === "general" && (
        <p role="status" className={`rounded-xl p-3 text-[15px] font-semibold ${aviso.ok ? "bg-ok-fondo text-ok" : "bg-error-fondo text-error"}`}>{aviso.t}</p>
      )}

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…"
          aria-label="Buscar asistente"
          className="min-h-[48px] w-full rounded-xl border border-linea-fuerte bg-white pl-10 pr-3 text-[16px] outline-none focus:border-magenta focus:ring-4 focus:ring-magenta/15" />
      </div>

      <div role="tablist" aria-label="Filtrar asistentes" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {pestañas.filter((p) => p.c > 0 || p.k === "confirmados" || p.k === vista).map((p) => {
          const on = p.k === vista;
          return (
            <button key={p.k} role="tab" aria-selected={on} onClick={() => setVista(p.k)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold ${
                on ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta"}`}>
              {p.label}
              <span className={`rounded-full px-1.5 text-xs font-bold ${on ? "bg-white/20" : "bg-marfil-100 text-tinta-suave"}`}>{p.c}</span>
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-linea p-3 text-[15px] text-tinta-suave">{q ? "Nadie con ese nombre en esta lista." : "Nadie en esta lista."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-linea rounded-xl border border-linea">
          {visibles.slice(0, cuantos).map((f) => (
            <li key={f.inscripcion_id} className="flex flex-col gap-2 p-2.5 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {f.estado === "espera" && (
                  <span className="grid h-8 min-w-[32px] shrink-0 place-items-center rounded-full bg-aviso-fondo text-[14px] font-bold text-aviso"
                    aria-label={`Puesto ${f.puesto} en la espera`}>{f.puesto}</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">
                    {f.nombre}
                    {guardando === f.inscripcion_id && <Loader2 size={14} className="ml-2 inline animate-spin text-tinta-suave" aria-label="Guardando" />}
                  </span>
                  {(f.email || f.estado !== "apuntado") && (
                    <span className="block truncate text-sm text-tinta-suave">
                      {f.estado === "espera" && <><Hourglass size={12} className="mr-1 inline" aria-hidden />En espera · </>}
                      {f.estado === "cancelado" && "Cancelado · "}
                      {f.email ?? ""}
                    </span>
                  )}
                </span>
              </span>

              {f.estado === "apuntado" && (
                <div className="flex flex-wrap gap-1">
                  <div role="group" aria-label={`Asistencia de ${f.nombre}`} className="flex basis-full gap-1 sm:basis-auto">
                    {OPCIONES.map(({ v, label, icono: I }) => {
                      const on = (f.asistencia ?? "pendiente") === v;
                      const tono = v === "asistio" ? "border-ok bg-ok text-white" : v === "no_asistio" ? "border-error bg-error text-white" : "border-tinta bg-tinta text-white";
                      return (
                        <button key={v} type="button" aria-pressed={on} disabled={!!guardando}
                          onClick={() => marcar(f, v)}
                          className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-2 text-[14px] font-semibold transition disabled:opacity-60 sm:flex-none sm:px-3 ${
                            on ? tono : "border-linea-fuerte bg-white text-tinta hover:bg-marfil-100"}`}>
                          {I && <I size={15} aria-hidden />} {label}
                        </button>
                      );
                    })}
                  </div>
                  {aforo != null && (
                    <Accion onClick={() => mover(f, "espera")} disabled={!!guardando} icono={<ArrowDownToLine size={15} aria-hidden />}>A espera</Accion>
                  )}
                  <Cancelar f={f} confirmar={confirmar} setConfirmar={setConfirmar} onSi={() => mover(f, "cancelado")} disabled={!!guardando} />
                </div>
              )}
              {f.estado === "espera" && (
                <div className="flex flex-wrap gap-1">
                  <Accion fuerte onClick={() => mover(f, "apuntado")} disabled={!!guardando} icono={<UserPlus size={15} aria-hidden />}>Dar plaza</Accion>
                  <Cancelar f={f} confirmar={confirmar} setConfirmar={setConfirmar} onSi={() => mover(f, "cancelado")} disabled={!!guardando} texto="Quitar" />
                </div>
              )}
              {f.estado === "cancelado" && (
                <Accion onClick={() => mover(f, "apuntado")} disabled={!!guardando} icono={<Undo2 size={15} aria-hidden />}>Volver a confirmar</Accion>
              )}
              {aviso?.id === f.inscripcion_id && <p role="alert" className="text-sm font-semibold text-error sm:basis-full">{aviso.t}</p>}
            </li>
          ))}
        </ul>
      )}
      {visibles.length > cuantos && (
        <button type="button" onClick={() => setCuantos((c) => c + POR_TANDA)}
          className="min-h-[48px] rounded-xl border border-linea-fuerte bg-white text-[15px] font-semibold text-tinta">
          Ver {Math.min(POR_TANDA, visibles.length - cuantos)} más (quedan {visibles.length - cuantos})
        </button>
      )}
    </div>
  );
}

function Dato({ t, v, pie }: { t: string; v: string; pie?: string }) {
  return (
    <div className="rounded-xl border border-linea bg-white p-2.5">
      <dt className="text-[13px] font-semibold text-tinta-suave">{t}</dt>
      <dd className="text-[20px] font-extrabold leading-tight text-tinta">{v}</dd>
      {pie && <dd className="text-[13px] text-tinta-suave">{pie}</dd>}
    </div>
  );
}

function Accion({ children, onClick, disabled, icono, fuerte }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; icono?: React.ReactNode; fuerte?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border px-3 text-[14px] font-semibold disabled:opacity-60 ${
        fuerte ? "border-magenta bg-magenta text-white" : "border-linea-fuerte bg-white text-tinta hover:bg-marfil-100"}`}>
      {icono}{children}
    </button>
  );
}

/**
 * Cancelar pide un segundo toque: en la puerta, con prisa, un dedo se va solo.
 * El primer toque cambia el botón a «¿Seguro?» y el segundo cancela.
 */
function Cancelar({ f, confirmar, setConfirmar, onSi, disabled, texto = "Cancelar" }: {
  f: FilaLista; confirmar: string | null; setConfirmar: (id: string | null) => void; onSi: () => void; disabled?: boolean; texto?: string;
}) {
  const pidiendo = confirmar === f.inscripcion_id;
  return pidiendo ? (
    <span className="inline-flex gap-1">
      <button type="button" onClick={onSi} disabled={disabled}
        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-error bg-error px-3 text-[14px] font-bold text-white">
        <Ban size={15} aria-hidden /> ¿Seguro?
      </button>
      <button type="button" onClick={() => setConfirmar(null)}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-linea-fuerte bg-white px-3 text-[14px] font-semibold text-tinta">No</button>
    </span>
  ) : (
    <button type="button" onClick={() => setConfirmar(f.inscripcion_id)} disabled={disabled}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-linea-fuerte bg-white px-3 text-[14px] font-semibold text-error hover:bg-error-fondo disabled:opacity-60">
      <Ban size={15} aria-hidden /> {texto}
    </button>
  );
}
