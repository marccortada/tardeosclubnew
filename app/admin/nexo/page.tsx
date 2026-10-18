"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Trash2, Plus, Loader2 } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { useReproductor } from "@/components/musica/Reproductor";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { ESTADOS_NEXO, faltaLote, MENSAJE_FALTA_LOTE, type EnvioNexo } from "@/lib/sets";
import { Buscador, useDiferido } from "@/components/panel/Paginacion";
import PanelFiltros, { RangoFechas } from "@/components/panel/PanelFiltros";
import { limpiarBusqueda, rangoTimestamp } from "@/lib/filtrosLista";

type Envio = EnvioNexo & { djs: { nombre_artistico: string } | null };
type Franja = { id: string; dia_semana: number | null; hora: string; titulo: string; detalle: string | null };
const ESTADOS = ["pendiente", "aceptado", "emitido", "rechazado"] as const;
const DIAS = ["Cada día", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const POR_PAGINA = 20;

/**
 * Bandeja de Nexo Radio: envíos de sesiones de los DJs (aceptar, rechazar,
 * marcar como emitida, con nota que el DJ ve) y la programación que sale en
 * /nexo. Lo aceptado/emitido aparece en "Descubre sesiones".
 */
export default function AdminNexo() {
  const { user } = useAuth();
  const { reproducir } = useReproductor();
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>("pendiente");
  const [pagina, setPagina] = useState(0);
  const [filas, setFilas] = useState<Envio[] | null>(null);
  const [total, setTotal] = useState(0);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Búsqueda (título o DJ) y fechas de envío, en el servidor.
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const activos = [fDesde, fHasta].filter(Boolean).length;
  // Cambiar un filtro vuelve a la primera página (si no, se puede quedar en
  // una página que ya no existe y decir «no hay envíos»).
  const conPagina0 = (set: (v: string) => void) => (v: string) => { set(v); setPagina(0); };

  const cargar = useCallback(async () => {
    let q = supabase.from("nexo_envios")
      .select("id,dj_id,set_id,titulo,url,descripcion,estado,nota_nexo,created_at,revisado_en,djs(nombre_artistico)", { count: "exact" })
      .eq("estado", estado);
    q = rangoTimestamp(q, "created_at", fDesde, fHasta);
    const l = limpiarBusqueda(busca);
    if (l) {
      // El nombre del DJ está en `djs`: se buscan primero sus ids (tope 100).
      const { data: djs } = await supabase.from("djs").select("id").ilike("nombre_artistico", `%${l}%`).limit(100);
      const ids = ((djs ?? []) as { id: string }[]).map((d) => d.id);
      q = q.or(ids.length ? `titulo.ilike.%${l}%,dj_id.in.(${ids.join(",")})` : `titulo.ilike.%${l}%`);
    }
    const { data, error, count } = await q.order("created_at", { ascending: false }).order("id")
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if (error) { setError(faltaLote(error) ? MENSAJE_FALTA_LOTE : error.message); setFilas([]); return; }
    setError(null); setFilas((data ?? []) as unknown as Envio[]); setTotal(count ?? 0);
  }, [estado, pagina, busca, fDesde, fHasta]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function decidir(e: Envio, nuevo: EnvioNexo["estado"]) {
    const cambios: Record<string, unknown> = {
      estado: nuevo, nota_nexo: (notas[e.id] ?? e.nota_nexo ?? "").trim() || null,
      revisado_por: user?.id ?? null, revisado_en: new Date().toISOString(),
    };
    if (nuevo === "emitido") cambios.emitido_en = new Date().toISOString();
    const { error } = await supabase.from("nexo_envios").update(cambios).eq("id", e.id);
    if (error) { setError(error.message); return; }
    // Rastro (lote 63). Si falla, no bloquea la decisión.
    void supabase.rpc("auditar", { p_accion: `nexo_${nuevo}`, p_entidad: "nexo_envio", p_entidad_id: e.id, p_zona: null, p_detalle: { titulo: e.titulo } });
    await cargar();
  }

  return (
    <SeccionPanel titulo="Nexo Radio" descripcion="Sesiones que envían los DJs y programación de la radio.">
      <div role="tablist" className="flex flex-wrap gap-2">
        {ESTADOS.map((k) => (
          <button key={k} role="tab" aria-selected={estado === k} type="button" onClick={() => { setEstado(k); setPagina(0); }}
            className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold ${estado === k ? "bg-magenta-50 text-magenta" : "border border-linea"}`}>
            {ESTADOS_NEXO[k]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <Buscador valor={texto} onCambiar={conPagina0(setTexto)} placeholder="Buscar por título o DJ…" />
        <PanelFiltros clave="admin-nexo" activos={activos} onLimpiar={() => { setFDesde(""); setFHasta(""); setPagina(0); }}>
          <RangoFechas desde={fDesde} hasta={fHasta} onDesde={conPagina0(setFDesde)} onHasta={conPagina0(setFHasta)} etiqueta="Enviada" />
        </PanelFiltros>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-error-fondo p-3 text-[15px] text-error">{error}</p>}

      {filas === null ? <p className="mt-4 text-tinta-suave">Cargando…</p>
        : filas.length === 0 ? <p className="mt-4 text-[15px] text-tinta-suave">{busca || activos ? "Ningún envío con estos filtros." : "No hay envíos en este estado."}</p>
        : (
          <ul className="mt-4 flex flex-col gap-3">
            {filas.map((e) => (
              <li key={e.id} className="rounded-2xl border border-linea bg-superficie p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold">{e.titulo}</p>
                    <p className="text-[14px] text-tinta-suave">
                      <Link href={`/djs/${e.dj_id}`} className="underline">{e.djs?.nombre_artistico ?? "DJ"}</Link>
                      {" · "}{new Date(e.created_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => reproducir({ id: `nexo-envio-${e.id}`, titulo: e.titulo, autor: e.djs?.nombre_artistico, url: e.url, tipo: "set" })}
                      className="min-h-[44px] rounded-xl border border-linea px-3 text-[14px] font-bold">Escuchar</button>
                    <a href={e.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir enlace" className="grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-linea">
                      <ExternalLink size={18} aria-hidden />
                    </a>
                  </div>
                </div>
                {e.descripcion && <p className="mt-2 whitespace-pre-line text-[15px]">{e.descripcion}</p>}
                <textarea rows={2} maxLength={500} placeholder="Nota para el DJ (la verá en su panel)" aria-label="Nota para el DJ"
                  value={notas[e.id] ?? e.nota_nexo ?? ""} onChange={(ev) => setNotas((n) => ({ ...n, [e.id]: ev.target.value }))}
                  className="mt-3 w-full rounded-xl border border-linea bg-superficie px-3 py-2 text-[15px]" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {e.estado !== "aceptado" && <Accion onClick={() => void decidir(e, "aceptado")} primaria>Aceptar</Accion>}
                  {e.estado !== "emitido" && <Accion onClick={() => void decidir(e, "emitido")}>Marcar emitida</Accion>}
                  {e.estado !== "rechazado" && <Accion onClick={() => void decidir(e, "rechazado")}>No seleccionar</Accion>}
                  {e.estado !== "pendiente" && <Accion onClick={() => void decidir(e, "pendiente")}>Volver a pendiente</Accion>}
                </div>
              </li>
            ))}
          </ul>
        )}
      {total > POR_PAGINA && (
        <div className="mt-4 flex items-center justify-between">
          <Accion onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0}>Anterior</Accion>
          <span className="text-[14px] text-tinta-suave">Página {pagina + 1} de {Math.ceil(total / POR_PAGINA)}</span>
          <Accion onClick={() => setPagina((p) => p + 1)} disabled={(pagina + 1) * POR_PAGINA >= total}>Siguiente</Accion>
        </div>
      )}

      <Programacion />
    </SeccionPanel>
  );
}

function Programacion() {
  const [filas, setFilas] = useState<Franja[]>([]);
  const [hora, setHora] = useState("17:00");
  const [dia, setDia] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("nexo_programacion").select("id,dia_semana,hora,titulo,detalle")
      .order("dia_semana", { nullsFirst: true }).order("hora").order("orden");
    if (error) { setError(faltaLote(error) ? MENSAJE_FALTA_LOTE : error.message); return; }
    setFilas((data ?? []) as Franja[]);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function anadir(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const { error } = await supabase.from("nexo_programacion").insert({ hora, dia_semana: dia || null, titulo: titulo.trim(), detalle: detalle.trim() || null });
    setOcupado(false);
    if (error) { setError(error.message); return; }
    setTitulo(""); setDetalle(""); await cargar();
  }

  const campo = "min-h-tacto rounded-xl border border-linea bg-superficie px-3 text-[16px]";
  return (
    <section className="mt-10">
      <h2 className="text-[20px] font-bold">Programación</h2>
      <p className="text-[15px] text-tinta-suave">Lo que se ve en la pestaña Programación de /nexo.</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-error-fondo p-3 text-[15px] text-error">{error}</p>}
      <ul className="mt-3 divide-y divide-linea rounded-2xl border border-linea bg-superficie">
        {filas.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-4 py-2">
            <span className="w-14 text-[15px] font-bold">{f.hora.slice(0, 5)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">{f.titulo}</p>
              <p className="text-[14px] text-tinta-suave">{[DIAS[f.dia_semana ?? 0], f.detalle].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" aria-label={`Quitar ${f.titulo}`} className="grid h-11 w-11 place-items-center rounded-full text-tinta-suave"
              onClick={async () => { const { error } = await supabase.from("nexo_programacion").delete().eq("id", f.id); if (error) setError(error.message); else await cargar(); }}>
              <Trash2 size={18} aria-hidden />
            </button>
          </li>
        ))}
        {filas.length === 0 && <li className="px-4 py-3 text-[15px] text-tinta-suave">Sin franjas.</li>}
      </ul>
      <form onSubmit={anadir} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[110px_150px_1fr]">
        <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora" className={campo} />
        <select value={dia} onChange={(e) => setDia(Number(e.target.value))} aria-label="Día" className={campo}>
          {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <input required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Programa" aria-label="Programa" className={`${campo} col-span-2 sm:col-span-1`} />
        <input maxLength={200} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle (opcional)" aria-label="Detalle" className={`${campo} col-span-2 sm:col-span-2`} />
        <button type="submit" disabled={ocupado} className="col-span-2 inline-flex min-h-tacto items-center justify-center gap-2 rounded-xl bg-magenta font-bold text-white disabled:opacity-50 sm:col-span-1">
          {ocupado ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Plus size={18} aria-hidden />} Añadir franja
        </button>
      </form>
    </section>
  );
}

function Accion({ children, onClick, primaria, disabled }: { children: React.ReactNode; onClick: () => void; primaria?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`min-h-[44px] rounded-xl px-4 text-[15px] font-bold disabled:opacity-40 ${primaria ? "bg-magenta text-white" : "border border-linea"}`}>
      {children}
    </button>
  );
}
