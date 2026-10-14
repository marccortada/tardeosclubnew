"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, MapPin, Clock, Check, X, MessageCircle, UserX } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import { Etiqueta } from "@/components/ui/Chip";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";
import Boton, { claseBoton } from "@/components/Boton";
import { whatsappTardeos } from "@/components/ServiciosExternos";
import { supabase } from "@/lib/supabase";
import { hoyISO } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import { useDj, consultaTardeosDj, type TardeoDj } from "../contexto";

type Filtro = "proximos" | "pasados" | "invitaciones";

const ESTADOS: Record<string, { texto: string; tono: "ok" | "aviso" | "neutro" | "error" }> = {
  publicado: { texto: "Publicado", tono: "ok" },
  programado: { texto: "Programado", tono: "aviso" },
  borrador: { texto: "Borrador", tono: "neutro" },
  finalizado: { texto: "Finalizado", tono: "neutro" },
  cancelado: { texto: "Cancelado", tono: "error" },
};

type Invitacion = {
  id: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  created_at: string;
  tardeo_id: string;
  titulo: string;
  fecha: string;
  hora_inicio: string | null;
  local_nombre: string | null;
  zona: string | null;
};

/** La función o la tabla de invitaciones no existe todavía (falta el lote 55). */
const faltaLote55 = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01" || /invitaciones_de_dj|dj_invitaciones/.test(e.message ?? ""));

/**
 * Los tardeos en los que pincha el DJ (tabla tardeo_djs) y sus invitaciones.
 * Los tardeos los añade el local; si uno está mal enlazado (pasa tras la
 * migración), el DJ puede quitarse con "No pincho aquí".
 */
export default function MisTardeosDj() {
  const { dj, modoAdmin } = useDj();
  const [filtro, setFiltro] = useState<Filtro>("proximos");
  const [cuentas, setCuentas] = useState<{ proximos: number | null; pasados: number | null; invitaciones: number | null }>({ proximos: null, pasados: null, invitaciones: null });
  const [quitar, setQuitar] = useState<TardeoDj | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string; contacto?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const hoy = hoyISO();

  const p = usePaginado<TardeoDj>(
    (desde, hasta) => {
      // En la pestaña de invitaciones no se usa: se pide algo mínimo.
      const q = consultaTardeosDj(dj.id);
      return (filtro === "pasados"
        ? q.lt("fecha", hoy).order("fecha", { ascending: false }).order("id")
        : q.gte("fecha", hoy).order("fecha", { ascending: true }).order("id")
      ).range(desde, hasta) as unknown as PromiseLike<{ data: TardeoDj[] | null; count: number | null; error: unknown }>;
    },
    [dj.id, filtro === "pasados", hoy, version],
  );

  useEffect(() => {
    let vivo = true;
    const contar = (pasados: boolean) => {
      const q = consultaTardeosDj(dj.id);
      return (pasados ? q.lt("fecha", hoy) : q.gte("fecha", hoy)).range(0, 0);
    };
    const pendientes = supabase.from("dj_invitaciones").select("id", { count: "exact", head: true })
      .eq("dj_id", dj.id).eq("estado", "pendiente");
    Promise.all([contar(false), contar(true), pendientes]).then(([a, b, c]) => {
      if (vivo) setCuentas({ proximos: a.count ?? null, pasados: b.count ?? null, invitaciones: c.error ? null : c.count ?? 0 });
    });
    return () => { vivo = false; };
  }, [dj.id, hoy, version]);

  const confirmarQuitar = async () => {
    if (!quitar) return;
    setQuitando(true); setAviso(null);
    const { data, error } = await supabase.from("tardeo_djs").delete()
      .eq("tardeo_id", quitar.id).eq("dj_id", dj.id).select("tardeo_id");
    setQuitando(false);
    const t = quitar;
    setQuitar(null);
    if (error || !data?.length) {
      // Sin el lote 55 la RLS solo deja al local quitar DJs: 0 filas.
      setAviso({
        tono: "error",
        texto: `No hemos podido quitarte de «${t.titulo}». Escríbenos y lo corregimos.`,
        contacto: whatsappTardeos(`Hola, soy ${dj.nombre_artistico} (DJ). Aparezco en el tardeo «${t.titulo}» (${formatFecha(t.fecha)}) y no pincho ahí. ¿Podéis quitarme?`),
      });
      return;
    }
    p.quitar((f) => f.id === t.id);
    setCuentas((c) => ({ ...c, [filtro]: Math.max(0, (c[filtro as "proximos" | "pasados"] ?? 1) - 1) }));
    setAviso({ tono: "ok", texto: `Listo: ya no sales en «${t.titulo}».` });
  };

  const vacio = filtro === "proximos"
    ? "No tienes tardeos próximos. Cuando un local te añada como DJ a un tardeo, aparecerá aquí."
    : "Todavía no hay tardeos pasados contigo como DJ.";

  return (
    <SeccionPanel titulo="Mis tardeos" descripcion="Los tardeos en los que pinchas y las invitaciones de los locales.">
      <div className="mb-4">
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={(f) => { setFiltro(f); setAviso(null); }}
          opciones={[
            { clave: "proximos", label: "Próximos", n: cuentas.proximos },
            { clave: "pasados", label: "Pasados", n: cuentas.pasados },
            { clave: "invitaciones", label: "Invitaciones", n: cuentas.invitaciones },
          ]}
        />
      </div>

      {aviso && (
        <div className="mb-3">
          <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
          {aviso.contacto && (
            <a href={aviso.contacto} target="_blank" rel="noopener noreferrer" className={claseBoton("contorno", "pequeno")}>
              <MessageCircle size={18} aria-hidden /> Escribir a TardeosClub
            </a>
          )}
        </div>
      )}

      {filtro === "invitaciones" ? (
        <Invitaciones djId={dj.id} modoAdmin={modoAdmin} onCambio={() => setVersion((v) => v + 1)} />
      ) : (
        <>
          <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length} vacio={vacio} />

          {!p.cargando && !p.error && p.filas.length === 0 && filtro === "proximos" && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link href={`/djs/${dj.id}`} className={claseBoton("contorno", "pequeno")}>Ver mi ficha pública</Link>
            </div>
          )}

          {p.filas.length > 0 && (
            <ul className={`flex flex-col gap-2 ${p.cargando ? "opacity-60" : ""}`}>
              {p.filas.map((t) => {
                const est = ESTADOS[t.estado] ?? { texto: t.estado, tono: "neutro" as const };
                const [, mes, dia] = t.fecha.split("-");
                const nombreMes = new Date(Number(t.fecha.slice(0, 4)), Number(mes) - 1, 1)
                  .toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
                return (
                  <li key={t.id} className="flex flex-col rounded-2xl border border-linea bg-white shadow-tarjeta sm:flex-row sm:items-center">
                    <Link href={`/tardeos/${t.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 transition-colors hover:text-magenta-700 md:p-4">
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-magenta-50 text-center leading-none text-magenta-700">
                        <span>
                          <span className="block text-xl font-bold">{Number(dia)}</span>
                          <span className="block text-xs font-semibold uppercase">{nombreMes}</span>
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold md:text-base">{t.titulo}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-tinta-suave">
                          {t.locales?.nombre && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {t.locales.nombre}{t.locales.zona ? ` · ${t.locales.zona}` : ""}</span>}
                          {t.hora_inicio && <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> {t.hora_inicio.slice(0, 5)}</span>}
                        </span>
                        {t.estado !== "publicado" && <span className="mt-1 inline-block"><Etiqueta tono={est.tono}>{est.texto}</Etiqueta></span>}
                      </span>
                      <ChevronRight size={20} className="shrink-0 text-tinta-suave" aria-hidden />
                    </Link>
                    <div className="border-t border-linea px-3 py-2 sm:border-l sm:border-t-0 sm:py-3">
                      <button type="button" onClick={() => { setAviso(null); setQuitar(t); }}
                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-3 text-[15px] font-semibold text-tinta-suave hover:bg-marfil-100 hover:text-error">
                        <UserX size={18} aria-hidden /> No pincho aquí
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
        </>
      )}

      <Hoja
        abierta={!!quitar}
        onCerrar={() => !quitando && setQuitar(null)}
        titulo="¿Quitarte de este tardeo?"
        pie={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="contorno" onClick={() => setQuitar(null)} disabled={quitando}>Cancelar</Boton>
            <Boton variante="peligro" onClick={confirmarQuitar} cargando={quitando}>Sí, no pincho aquí</Boton>
          </div>
        }
      >
        <p className="text-[16px]">
          Dejarás de salir como DJ en <b>{quitar?.titulo}</b>{quitar ? ` (${formatFecha(quitar.fecha)})` : ""}. Úsalo si te pusieron por error.
        </p>
        <p className="mt-2 text-[15px] text-tinta-suave">Si el local vuelve a necesitarte, te puede invitar de nuevo.</p>
      </Hoja>
    </SeccionPanel>
  );
}

/**
 * Bandeja de invitaciones. Son pocas por DJ, así que se piden hasta 100 sin
 * paginar. Se leen con la función del lote 55 porque el tardeo puede estar en
 * borrador y la RLS no le dejaría ver ni el título.
 */
function Invitaciones({ djId, modoAdmin, onCambio }: { djId: string; modoAdmin: boolean; onCambio: () => void }) {
  const [lista, setLista] = useState<Invitacion[] | null>(null);
  const [error, setError] = useState<"" | "falta" | string>("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("invitaciones_de_dj", { p_dj: djId }).range(0, 99);
    if (e) { setError(faltaLote55(e) ? "falta" : e.message); setLista([]); return; }
    setError("");
    setLista((data as Invitacion[]) ?? []);
  }, [djId]);

  useEffect(() => {
    // Carga inicial desde la base (sistema externo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const responder = async (inv: Invitacion, estado: "aceptada" | "rechazada") => {
    setOcupada(inv.id); setMsg(null);
    const { data, error: e } = await supabase.from("dj_invitaciones").update({ estado })
      .eq("id", inv.id).eq("estado", "pendiente").select("id");
    setOcupada(null);
    if (e || !data?.length) {
      setMsg({ tono: "error", texto: "No se pudo guardar tu respuesta. Puede que el local la haya retirado. Recarga y vuelve a probar." });
      return;
    }
    setLista((l) => (l ?? []).map((x) => (x.id === inv.id ? { ...x, estado } : x)));
    setMsg({ tono: "ok", texto: estado === "aceptada" ? `Aceptada: ya sales en «${inv.titulo}».` : "Invitación rechazada." });
    onCambio();
  };

  if (lista === null) return <EstadoLista cargando error={null} filas={0} vacio="" />;
  if (error === "falta") {
    return (
      <Aviso tono="aviso">
        Las invitaciones todavía no están activadas.{modoAdmin ? " Falta pegar el lote 55 (supabase/55_invitaciones_dj.sql)." : " Mientras tanto, los locales te añaden directamente a sus tardeos."}
      </Aviso>
    );
  }
  if (error) return <Aviso tono="error">No se pudieron cargar las invitaciones: {error}</Aviso>;

  return (
    <>
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
      {lista.length === 0 ? (
        <EstadoLista cargando={false} error={null} filas={0}
          vacio="No tienes invitaciones. Cuando un local te invite a pinchar en un tardeo, la verás aquí para aceptarla o rechazarla." />
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((inv) => (
            <li key={inv.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold">{inv.titulo}</p>
                  <p className="mt-0.5 text-sm text-tinta-suave">
                    {formatFecha(inv.fecha)}{inv.hora_inicio ? ` · ${inv.hora_inicio.slice(0, 5)}` : ""}
                    {inv.local_nombre ? ` · ${inv.local_nombre}` : ""}{inv.zona ? ` (${inv.zona})` : ""}
                  </p>
                </div>
                {inv.estado === "aceptada" && <Etiqueta tono="ok">Aceptada</Etiqueta>}
                {inv.estado === "rechazada" && <Etiqueta tono="neutro">Rechazada</Etiqueta>}
                {inv.estado === "pendiente" && <Etiqueta tono="marca">Pendiente</Etiqueta>}
              </div>
              {inv.estado === "pendiente" && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Boton tamano="pequeno" onClick={() => responder(inv, "aceptada")} cargando={ocupada === inv.id} disabled={!!ocupada}>
                    <Check size={18} aria-hidden /> Aceptar
                  </Boton>
                  <Boton variante="contorno" tamano="pequeno" onClick={() => responder(inv, "rechazada")} disabled={!!ocupada}>
                    <X size={18} aria-hidden /> Rechazar
                  </Boton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
