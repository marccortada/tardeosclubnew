"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dices, ExternalLink, Pencil, Plus, Send, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, EstadoLista, Filtros } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import Campo, { claseCampo } from "@/components/ui/Campo";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { COLS_SORTEO, etiquetaSorteo, type Sorteo } from "@/lib/sorteos";

type Filtro = "todos" | "borrador" | "abierto" | "cerrado" | "resuelto";
type Resolucion = { ganador_id: string | null; ganador_alias: string | null; ganador_email: string | null; metodo: string | null; semilla: string | null; elegido_en: string | null; participantes: number };
type Perfil = { email: string | null; display_name: string | null; alias: string | null };
// PostgREST puede devolver la relación como objeto o como lista de uno.
type Participante = { id: string; profile_id: string; created_at: string; perfil: Perfil | Perfil[] | null };
const perfilDe = (x: Participante): Perfil | null => (Array.isArray(x.perfil) ? x.perfil[0] ?? null : x.perfil);

const VACIO = { titulo: "Tu próxima tarde, invitada", descripcion: "", premio: "", bases: "", imagen_url: "", tardeo_id: "", zona_madre: "", abre: "", cierra: "", estado: "borrador" as Sorteo["estado"] };
// datetime-local trabaja en hora local del navegador del admin (España).
const aLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

/**
 * Sorteos (dossier pág. 14-15): Cristina los gestiona, Álex también puede.
 * Crear/editar, ver participantes, elegir ganador al azar REPRODUCIBLE (con
 * semilla) o a mano, y publicar. Elegir y publicar van por funciones de la base
 * que dejan rastro en `auditoria`.
 */
export default function AdminSorteos() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [form, setForm] = useState<(typeof VACIO & { id?: string }) | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [sel, setSel] = useState<Sorteo | null>(null);

  const p = usePaginado<Sorteo>((d, h) => {
    let q = supabase.from("sorteos").select(COLS_SORTEO, { count: "exact" });
    if (filtro !== "todos") q = q.eq("estado", filtro);
    return q.order("created_at", { ascending: false }).order("id").range(d, h);
  }, [filtro]);

  const guardar = async () => {
    if (!form) return;
    if (!form.titulo.trim() || !form.premio.trim() || !form.cierra) { setAviso({ tono: "error", texto: "Faltan título, premio o fecha de cierre." }); return; }
    setGuardando(true); setAviso(null);
    const fila = {
      titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null, premio: form.premio.trim(), bases: form.bases.trim() || null,
      imagen_url: form.imagen_url.trim() || null, tardeo_id: form.tardeo_id.trim() || null, zona_madre: form.zona_madre || null,
      abre: form.abre ? new Date(form.abre).toISOString() : new Date().toISOString(), cierra: new Date(form.cierra).toISOString(), estado: form.estado,
    };
    const { data: u } = await supabase.auth.getUser();
    const r = form.id
      ? await supabase.from("sorteos").update(fila).eq("id", form.id).select("id")
      : await supabase.from("sorteos").insert({ ...fila, responsable: u.user?.id, created_by: u.user?.id }).select("id");
    setGuardando(false);
    if (r.error || !r.data?.length) { setAviso({ tono: "error", texto: `No se pudo guardar: ${r.error?.message ?? "sin permiso"}` }); return; }
    await supabase.rpc("auditar", { p_accion: form.id ? "editar" : "crear", p_entidad: "sorteo", p_entidad_id: r.data[0].id, p_zona: fila.zona_madre, p_detalle: { estado: fila.estado } });
    setForm(null); setAviso({ tono: "ok", texto: "Sorteo guardado." }); p.recargar();
  };

  return (
    <SeccionPanel titulo="Sorteos" descripcion="Crear, revisar participantes, elegir y publicar ganador. Cada paso queda en la auditoría."
      acciones={<Boton tamano="pequeno" onClick={() => setForm({ ...VACIO })}><Plus size={18} aria-hidden /> Nuevo sorteo</Boton>} ancho="ancho">
      <div className="mb-4">
        <Filtros<Filtro> valor={filtro} onCambiar={setFiltro} opciones={[
          { clave: "todos", label: "Todos" }, { clave: "borrador", label: "Borradores" }, { clave: "abierto", label: "Abiertos" },
          { clave: "cerrado", label: "Cerrados" }, { clave: "resuelto", label: "Con ganador" },
        ]} />
      </div>
      <div aria-live="polite">{aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}</div>
      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length} vacio="Todavía no hay sorteos." />
      <ul className="flex flex-col gap-2">
        {p.filas.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="font-bold">{s.titulo}</p>
              <p className="text-sm text-tinta-suave">{s.premio} · cierra {new Date(s.cierra).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}{s.zona_madre ? ` · ${s.zona_madre}` : ""}</p>
              <div className="mt-1 flex gap-1.5">
                <Etiqueta tono={s.estado === "resuelto" ? "ok" : s.estado === "borrador" ? "neutro" : "marca"}>{s.estado === "borrador" ? "Borrador" : etiquetaSorteo(s)}</Etiqueta>
                {s.ganador_alias && <Etiqueta tono="ok">Ganador: {s.ganador_alias}</Etiqueta>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Boton variante="contorno" tamano="pequeno" onClick={() => setSel(s)}><UserCheck size={16} aria-hidden /> Participantes</Boton>
              {s.estado !== "resuelto" && (
                <Boton variante="contorno" tamano="pequeno" onClick={() => setForm({
                  id: s.id, titulo: s.titulo, descripcion: s.descripcion ?? "", premio: s.premio, bases: s.bases ?? "", imagen_url: s.imagen_url ?? "",
                  tardeo_id: s.tardeo_id ?? "", zona_madre: s.zona_madre ?? "", abre: aLocal(s.abre), cierra: aLocal(s.cierra), estado: s.estado,
                })}><Pencil size={16} aria-hidden /> Editar</Boton>
              )}
              {s.estado !== "borrador" && <Link href={`/sorteos/${s.id}`} target="_blank" aria-label="Ver en la app" className="grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-linea-fuerte"><ExternalLink size={16} aria-hidden /></Link>}
            </div>
          </li>
        ))}
      </ul>
      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <Hoja abierta={!!form} onCerrar={() => !guardando && setForm(null)} titulo={form?.id ? "Editar sorteo" : "Nuevo sorteo"}>
        {form && (
          <div className="flex flex-col gap-3">
            <Campo etiqueta="Título" htmlFor="s-t"><input id="s-t" className={claseCampo} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></Campo>
            <Campo etiqueta="Premio" htmlFor="s-p"><input id="s-p" className={claseCampo} placeholder="2 entradas para Sunset en la terraza" value={form.premio} onChange={(e) => setForm({ ...form, premio: e.target.value })} /></Campo>
            <Campo etiqueta="Descripción" htmlFor="s-d"><textarea id="s-d" rows={2} className={claseCampo} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Campo>
            <Campo etiqueta="Bases" htmlFor="s-b" ayuda="Condiciones, cómo se elige y cómo se contacta al ganador."><textarea id="s-b" rows={5} className={claseCampo} value={form.bases} onChange={(e) => setForm({ ...form, bases: e.target.value })} /></Campo>
            <Campo etiqueta="Imagen (URL)" htmlFor="s-i"><input id="s-i" className={claseCampo} value={form.imagen_url} onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} /></Campo>
            <Campo etiqueta="Tardeo relacionado (id, opcional)" htmlFor="s-td"><input id="s-td" className={claseCampo} value={form.tardeo_id} onChange={(e) => setForm({ ...form, tardeo_id: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Abre" htmlFor="s-a"><input id="s-a" type="datetime-local" className={claseCampo} value={form.abre} onChange={(e) => setForm({ ...form, abre: e.target.value })} /></Campo>
              <Campo etiqueta="Cierra" htmlFor="s-c"><input id="s-c" type="datetime-local" className={claseCampo} value={form.cierra} onChange={(e) => setForm({ ...form, cierra: e.target.value })} /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Zona" htmlFor="s-z">
                <select id="s-z" className={claseCampo} value={form.zona_madre} onChange={(e) => setForm({ ...form, zona_madre: e.target.value })}>
                  <option value="">Todas</option><option value="barcelona">Barcelona</option><option value="tarragona">Tarragona</option><option value="girona">Girona</option>
                </select>
              </Campo>
              <Campo etiqueta="Estado" htmlFor="s-e">
                <select id="s-e" className={claseCampo} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as Sorteo["estado"] })}>
                  <option value="borrador">Borrador (no se ve)</option><option value="abierto">Abierto</option>
                  {form.id && <option value="cerrado">Cerrado</option>}
                </select>
              </Campo>
            </div>
            <Boton ancho cargando={guardando} onClick={guardar}>Guardar</Boton>
          </div>
        )}
      </Hoja>

      <Hoja abierta={!!sel} onCerrar={() => setSel(null)} titulo={sel ? `Participantes · ${sel.titulo}` : ""}>
        {sel && <Participantes s={sel} onCambio={(m) => { setAviso(m); p.recargar(); }} />}
      </Hoja>
    </SeccionPanel>
  );
}

function Participantes({ s, onCambio }: { s: Sorteo; onCambio: (m: { tono: "ok" | "error"; texto: string }) => void }) {
  const [res, setRes] = useState<Resolucion | null>(null);
  const [semilla, setSemilla] = useState("");
  const [obrando, setObrando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [v, setV] = useState(0);
  const p = usePaginado<Participante>((d, h) =>
    supabase.from("sorteo_participaciones").select("id,profile_id,created_at,perfil:profiles(email,display_name,alias)", { count: "exact" })
      .eq("sorteo_id", s.id).order("created_at").order("id").range(d, h) as unknown as PromiseLike<{ data: Participante[] | null; count: number | null; error: unknown }>, [s.id], 20);

  useEffect(() => {
    supabase.rpc("sorteo_resolucion", { p_sorteo: s.id }).then(({ data }) => setRes(((data ?? []) as Resolucion[])[0] ?? null));
  }, [s.id, v]);

  const correr = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setObrando(true); setErr(null);
    const { error } = await fn();
    setObrando(false);
    if (error) { setErr(error.message); return; }
    setV((x) => x + 1); onCambio({ tono: "ok", texto: ok });
  };
  const resuelto = s.estado === "resuelto";
  const cerrado = s.estado === "cerrado" || new Date(s.cierra) < new Date();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px]"><b>{res?.participantes ?? p.total}</b> participantes.</p>
      {res?.ganador_id && (
        <div className="rounded-xl bg-ok-fondo p-3 text-[15px]">
          <p><b>Elegido:</b> {res.ganador_alias || "—"} ({res.ganador_email ?? "sin email"})</p>
          <p className="text-sm">Método: {res.metodo === "azar" ? `al azar, semilla «${res.semilla}» (reproducible: md5(semilla + id) más bajo)` : "manual"}</p>
        </div>
      )}
      {err && <p role="alert" className="rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{err}</p>}
      {!resuelto && (
        cerrado ? (
          <div className="flex flex-col gap-2 rounded-xl border border-linea p-3">
            <Campo etiqueta="Semilla (opcional)" htmlFor="semilla" ayuda="Con la misma semilla y la misma lista sale el mismo ganador. Vacía: se genera una.">
              <input id="semilla" className={claseCampo} value={semilla} onChange={(e) => setSemilla(e.target.value)} />
            </Campo>
            <Boton variante="contorno" cargando={obrando} disabled={!p.total}
              onClick={() => correr(() => supabase.rpc("elegir_ganador_sorteo", { p_sorteo: s.id, p_semilla: semilla || null }), "Ganador elegido (aún no publicado).")}>
              <Dices size={18} aria-hidden /> Elegir al azar
            </Boton>
            {res?.ganador_id && (
              <Boton cargando={obrando} onClick={() => correr(() => supabase.rpc("publicar_ganador_sorteo", { p_sorteo: s.id }), "Ganador publicado y avisado.")}>
                <Send size={18} aria-hidden /> Publicar ganador
              </Boton>
            )}
          </div>
        ) : <p className="rounded-xl bg-aviso-fondo p-3 text-[15px] text-aviso">El sorteo sigue abierto: para elegir ganador, ciérralo (Editar → Cerrado) o espera a la fecha de cierre.</p>
      )}
      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length} vacio="Nadie participa todavía." />
      <ul className="divide-y divide-linea rounded-xl border border-linea">
        {p.filas.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{perfilDe(x)?.alias || perfilDe(x)?.display_name || "—"}</p>
              <p className="truncate text-sm text-tinta-suave">{perfilDe(x)?.email} · {new Date(x.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</p>
            </div>
            {!resuelto && cerrado && (
              <button disabled={obrando} onClick={() => correr(() => supabase.rpc("elegir_ganador_sorteo", { p_sorteo: s.id, p_ganador: x.profile_id }), "Ganador elegido a mano (aún no publicado).")}
                className="min-h-[40px] shrink-0 rounded-lg border border-linea-fuerte px-3 text-sm font-semibold hover:bg-marfil-100">Elegir</button>
            )}
          </li>
        ))}
      </ul>
      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
    </div>
  );
}
