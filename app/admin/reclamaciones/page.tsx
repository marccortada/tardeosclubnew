"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, Filtros, EstadoLista, Buscador, useDiferido } from "@/components/panel/Paginacion";
import PanelFiltros, { CampoFiltro, claseFiltro, RangoFechas } from "@/components/panel/PanelFiltros";
import { limpiarBusqueda, rangoTimestamp } from "@/lib/filtrosLista";
import Boton from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { enlaceTelefono } from "@/lib/crm";
import { Store, Disc3, Check, X, Phone, Mail, CalendarDays, ExternalLink, AlertTriangle, BadgeInfo } from "lucide-react";

type Solicitud = {
  id: string;
  tipo: "local" | "dj";
  objetivo_id: string;
  solicitante: string;
  cargo: string | null;
  telefono: string | null;
  mensaje: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  created_at: string;
  resuelta_en: string | null;
};

type Ficha = { nombre: string; dueno: string | null };
type Persona = { email: string | null; nombre: string | null };
type Filtro = "pendientes" | "resueltas";

const fecha = (f: string) => new Date(f).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

/**
 * Quién ha pedido quedarse con una ficha.
 *
 * TardeosClub publica locales y DJs antes de que ellos lleguen, y desde su
 * propia ficha pueden pedir gestionarla. Aquí se comprueba y se aprueba: no se
 * asigna solo porque cualquiera puede decir que lleva el Miracle.
 *
 * Aprobar llama a `aprobar_reclamacion` (lote 30), que enlaza la ficha y cierra
 * la solicitud en una sola operación. Hacerlo desde aquí con dos escrituras
 * dejaría, si falla la segunda, la ficha con dueño y la solicitud pendiente.
 *
 * Paginada en el servidor; nombres de ficha y emails solo de la página visible.
 */
export default function AdminReclamaciones() {
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [cuentas, setCuentas] = useState<Partial<Record<Filtro, number>>>({});
  const [fichas, setFichas] = useState<Map<string, Ficha>>(new Map());
  const [personas, setPersonas] = useState<Map<string, Persona>>(new Map());
  const [accion, setAccion] = useState<{ tipo: "aprobar" | "rechazar"; s: Solicitud } | null>(null);
  const [obrando, setObrando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  // Búsqueda y filtros plegables, en el servidor.
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [tipo, setTipo] = useState<"" | "local" | "dj">("");
  const [resultado, setResultado] = useState<"" | "aprobada" | "rechazada">("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  // «Resultado» solo cuenta en Resueltas (en Pendientes no se aplica).
  const activos = [tipo, filtro === "resueltas" ? resultado : "", fDesde, fHasta].filter(Boolean).length;
  const limpiarFiltros = () => { setTipo(""); setResultado(""); setFDesde(""); setFHasta(""); };

  const p = usePaginado<Solicitud>(
    (desde, hasta) => {
      let q = supabase.from("solicitudes_reclamacion")
        .select("id,tipo,objetivo_id,solicitante,cargo,telefono,mensaje,estado,created_at,resuelta_en", { count: "exact" });
      q = filtro === "pendientes" ? q.eq("estado", "pendiente")
        : resultado ? q.eq("estado", resultado) : q.neq("estado", "pendiente");
      if (tipo) q = q.eq("tipo", tipo);
      q = rangoTimestamp(q, "created_at", fDesde, fHasta);
      // El nombre de la ficha está en otra tabla (local o DJ): se busca en lo
      // que escribió quien pide, que es donde suele decir quién es.
      const l = limpiarBusqueda(busca);
      if (l) q = q.or(`mensaje.ilike.%${l}%,cargo.ilike.%${l}%,telefono.ilike.%${l}%`);
      return q.order(filtro === "pendientes" ? "created_at" : "resuelta_en", { ascending: filtro === "pendientes", nullsFirst: false })
        .order("id").range(desde, hasta) as unknown as PromiseLike<{ data: Solicitud[] | null; count: number | null; error: unknown }>;
    },
    [filtro, busca, tipo, resultado, fDesde, fHasta],
    25,
  );

  const contar = () => {
    Promise.all([
      supabase.from("solicitudes_reclamacion").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
      supabase.from("solicitudes_reclamacion").select("id", { count: "exact", head: true }).neq("estado", "pendiente"),
    ]).then(([a, b]) => setCuentas({ pendientes: a.count ?? undefined, resueltas: b.count ?? undefined }));
  };
  useEffect(contar, []);

  // Nombre y dueño actual de cada ficha + email de quien pide: dos o tres
  // consultas por página, no una por fila.
  useEffect(() => {
    const filas = p.filas;
    if (!filas.length) return;
    const locales = filas.filter((s) => s.tipo === "local").map((s) => s.objetivo_id);
    const djs = filas.filter((s) => s.tipo === "dj").map((s) => s.objetivo_id);
    const perfiles = [...new Set(filas.map((s) => s.solicitante))];
    Promise.all([
      locales.length ? supabase.from("locales").select("id,nombre,owner_id").in("id", locales) : Promise.resolve({ data: [] }),
      djs.length ? supabase.from("djs").select("id,nombre_artistico,profile_id").in("id", djs) : Promise.resolve({ data: [] }),
      supabase.from("profiles").select("id,email,display_name").in("id", perfiles),
    ]).then(([l, d, pr]) => {
      setFichas((prev) => {
        const m = new Map(prev);
        ((l.data ?? []) as { id: string; nombre: string; owner_id: string | null }[]).forEach((x) => m.set(x.id, { nombre: x.nombre, dueno: x.owner_id }));
        ((d.data ?? []) as { id: string; nombre_artistico: string; profile_id: string | null }[]).forEach((x) => m.set(x.id, { nombre: x.nombre_artistico, dueno: x.profile_id }));
        return m;
      });
      setPersonas((prev) => {
        const m = new Map(prev);
        ((pr.data ?? []) as { id: string; email: string | null; display_name: string | null }[]).forEach((x) => m.set(x.id, { email: x.email, nombre: x.display_name }));
        return m;
      });
    });
  }, [p.filas]);

  const confirmar = async () => {
    if (!accion) return;
    const { tipo, s } = accion;
    setObrando(true); setError(""); setOk("");
    const nombre = fichas.get(s.objetivo_id)?.nombre ?? "la ficha";
    if (tipo === "aprobar") {
      const { data, error: e } = await supabase.rpc("aprobar_reclamacion", { p_id: s.id });
      setObrando(false); setAccion(null);
      const r = data as { ok?: boolean; error?: string } | null;
      if (e) { setError("No se pudo aprobar: " + e.message); return; }
      if (!r?.ok) { setError(r?.error ?? "No se pudo aprobar."); return; }
      setOk(`Aprobada: ${nombre} ya es de ${personas.get(s.solicitante)?.email ?? "esa cuenta"}.`);
    } else {
      const { data, error: e } = await supabase
        .from("solicitudes_reclamacion")
        .update({ estado: "rechazada", resuelta_en: new Date().toISOString() })
        .eq("id", s.id)
        .select("id");
      setObrando(false); setAccion(null);
      if (e) { setError("No se pudo rechazar: " + e.message); return; }
      if (!data?.length) { setError("No se guardó nada. ¿Tu cuenta es admin?"); return; }
      setOk(`Rechazada la solicitud sobre ${nombre}.`);
    }
    p.quitar((x) => x.id === s.id);
    contar();
    if (p.filas.length === 1 && p.total > 1) p.recargar();
  };

  return (
    <SeccionPanel
      titulo="Reclamaciones de ficha"
      descripcion="Personas que dicen llevar un local o ser un DJ y piden gestionar su ficha. Compruébalo antes de aprobar."
    >
      <div className="mb-4">
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={(f) => { setFiltro(f); setOk(""); setError(""); }}
          opciones={[
            { clave: "pendientes", label: "Pendientes", n: cuentas.pendientes },
            { clave: "resueltas", label: "Resueltas", n: cuentas.resueltas },
          ]}
        />
        <div className="mt-3 flex flex-col gap-3">
          <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar en mensaje, cargo o teléfono…" />
          <PanelFiltros clave="admin-reclamaciones" activos={activos} onLimpiar={limpiarFiltros}>
            <CampoFiltro etiqueta="Ficha de">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={claseFiltro}>
                <option value="">Locales y DJs</option>
                <option value="local">Locales</option>
                <option value="dj">DJs</option>
              </select>
            </CampoFiltro>
            {filtro === "resueltas" && (
              <CampoFiltro etiqueta="Resultado">
                <select value={resultado} onChange={(e) => setResultado(e.target.value as typeof resultado)} className={claseFiltro}>
                  <option value="">Aprobadas y rechazadas</option>
                  <option value="aprobada">Aprobadas</option>
                  <option value="rechazada">Rechazadas</option>
                </select>
              </CampoFiltro>
            )}
            <RangoFechas desde={fDesde} hasta={fHasta} onDesde={setFDesde} onHasta={setFHasta} etiqueta="Pedida" />
          </PanelFiltros>
        </div>
      </div>

      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tono="ok">{ok}</Aviso>}

      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio={activos || busca ? "Ninguna solicitud con estos filtros." : filtro === "pendientes" ? "No hay solicitudes pendientes. Todo al día." : "Todavía no has resuelto ninguna."} />

      <ul className={`flex flex-col gap-3 ${p.cargando ? "opacity-60" : ""}`}>
        {p.filas.map((s) => {
          const ficha = fichas.get(s.objetivo_id);
          const persona = personas.get(s.solicitante);
          const yaTieneDueno = !!ficha?.dueno && ficha.dueno !== s.solicitante;
          const tel = enlaceTelefono(s.telefono);
          return (
            <li key={s.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marfil-100 text-tinta-suave">
                  {s.tipo === "local" ? <Store size={20} aria-hidden /> : <Disc3 size={20} aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={s.tipo === "local" ? `/locales/${s.objetivo_id}` : `/djs/${s.objetivo_id}`} target="_blank"
                      className="inline-flex items-center gap-1.5 text-[17px] font-bold leading-tight hover:text-magenta">
                      {ficha ? ficha.nombre : "…"} <ExternalLink size={14} aria-hidden />
                    </Link>
                    <Etiqueta>{s.tipo === "local" ? "Local" : "DJ"}</Etiqueta>
                    {s.estado === "aprobada" && <Etiqueta tono="ok">Aprobada</Etiqueta>}
                    {s.estado === "rechazada" && <Etiqueta tono="error">Rechazada</Etiqueta>}
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-tinta-suave">Quién lo pide</dt>
                      <dd className="font-semibold">
                        {persona?.nombre || "—"}
                        {persona?.email && (
                          <a href={`mailto:${persona.email}`} className="mt-0.5 flex items-center gap-1.5 font-medium text-magenta-700 hover:underline">
                            <Mail size={15} aria-hidden /> <span className="truncate">{persona.email}</span>
                          </a>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-tinta-suave">Qué es de la ficha</dt>
                      <dd className="font-semibold">{s.cargo || "No lo dice"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-tinta-suave">Teléfono</dt>
                      <dd className="font-semibold">
                        {s.telefono && tel ? (
                          <a href={tel} className="inline-flex items-center gap-1.5 text-magenta-700 hover:underline"><Phone size={15} aria-hidden /> {s.telefono}</a>
                        ) : "No lo ha dejado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-tinta-suave">Fechas</dt>
                      <dd className="flex items-center gap-1.5 font-semibold">
                        <CalendarDays size={15} aria-hidden className="text-tinta-suave" />
                        Pedida el {fecha(s.created_at)}
                        {s.resuelta_en ? ` · resuelta el ${fecha(s.resuelta_en)}` : ""}
                      </dd>
                    </div>
                  </dl>

                  {s.mensaje && (
                    <blockquote className="mt-3 rounded-xl bg-marfil-100 p-3 text-[15px]">«{s.mensaje}»</blockquote>
                  )}

                  {s.estado === "pendiente" && yaTieneDueno && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-aviso-fondo p-3 text-[15px] font-semibold text-aviso">
                      <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
                      Esta ficha ya tiene otro dueño. Si apruebas, mira antes quién la gestiona ahora.
                    </p>
                  )}
                </div>
              </div>

              {s.estado === "pendiente" && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Boton tamano="pequeno" onClick={() => setAccion({ tipo: "aprobar", s })}><Check size={18} aria-hidden /> Aprobar</Boton>
                  <Boton tamano="pequeno" variante="contorno" onClick={() => setAccion({ tipo: "rechazar", s })}><X size={18} aria-hidden /> Rechazar</Boton>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <p className="mt-6 flex items-start gap-2 text-[15px] text-tinta-suave">
        <BadgeInfo size={18} className="mt-0.5 shrink-0" aria-hidden />
        Aprobar enlaza la ficha con esa cuenta. Antes, llama o escribe para comprobar que es quien dice.
      </p>

      <Hoja
        abierta={!!accion}
        onCerrar={() => !obrando && setAccion(null)}
        titulo={accion?.tipo === "aprobar" ? "¿Aprobar la reclamación?" : "¿Rechazar la reclamación?"}
        pie={
          <div className="grid gap-2">
            {accion?.tipo === "aprobar"
              ? <Boton ancho cargando={obrando} onClick={confirmar}>Sí, darle la ficha</Boton>
              : <Boton variante="peligro" ancho cargando={obrando} onClick={confirmar}>Sí, rechazar</Boton>}
            <Boton variante="contorno" ancho disabled={obrando} onClick={() => setAccion(null)}>Cancelar</Boton>
          </div>
        }
      >
        {accion && (
          accion.tipo === "aprobar" ? (
            <p className="text-base">
              <strong>{fichas.get(accion.s.objetivo_id)?.nombre ?? "La ficha"}</strong> pasará a gestionarla{" "}
              <strong>{personas.get(accion.s.solicitante)?.email ?? "esta cuenta"}</strong>. Podrá editarla y publicar tardeos.
            </p>
          ) : (
            <p className="text-base">
              La solicitud se marca como rechazada y la ficha sigue como está.
            </p>
          )
        )}
      </Hoja>
    </SeccionPanel>
  );
}
