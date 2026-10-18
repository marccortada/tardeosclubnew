"use client";

import { useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, EstadoLista } from "@/components/panel/Paginacion";
import { Etiqueta } from "@/components/ui/Chip";
import { claseCampo } from "@/components/ui/Campo";
import { supabase } from "@/lib/supabase";
import { faltaLote, ZONAS_MADRE } from "@/components/admin/roles";
import PanelFiltros, { CampoFiltro, claseFiltro, RangoFechas } from "@/components/panel/PanelFiltros";
import { limpiarBusqueda, rangoTimestamp } from "@/lib/filtrosLista";

/**
 * Acciones y tipos que hoy escriben la base (`private.auditar`, lotes 66-69) y
 * las pantallas (`rpc("auditar")`). La acción se escribe a mano con estas como
 * sugerencia: algunas se forman al vuelo («coins_…», «cola_…», «nexo_…») y una
 * lista cerrada se quedaría corta el día que se añada otra.
 */
const ACCIONES = [
  "asignar_rol", "quitar_rol", "crear", "editar", "borrar", "elegir_ganador", "publicar_ganador",
  "mover_inscripcion", "promover_espera", "retirar", "desestimar", "coins_cancelar", "coins_estado",
  "ocultar_comentario", "mostrar_comentario",
];
const ENTIDADES: { clave: string; label: string }[] = [
  { clave: "admin_roles", label: "Roles del equipo" },
  { clave: "sorteo", label: "Sorteos" },
  { clave: "inscripcion", label: "Inscripciones" },
  { clave: "denuncia", label: "Denuncias" },
  { clave: "encuesta", label: "Encuestas" },
  { clave: "nexo_envio", label: "Envíos a Nexo" },
  { clave: "dj_solicitud", label: "Solicitudes de DJs" },
  { clave: "coins_reserva", label: "Reservas de Coins" },
  { clave: "local", label: "Locales" },
];

/**
 * Rastro de lo que hace el equipo (tabla `auditoria`, lote 63): quién, qué,
 * sobre qué, en qué zona y cuándo. Solo lectura: un rastro que se puede tocar
 * no es rastro.
 */
type Fila = {
  id: number; accion: string; entidad: string; entidad_id: string | null; zona_madre: string | null;
  detalle: Record<string, unknown> | null; created_at: string;
  actor: { display_name: string | null; email: string | null } | null;
};

export default function Auditoria() {
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [zona, setZona] = useState("");
  const [diaDesde, setDiaDesde] = useState("");
  const [diaHasta, setDiaHasta] = useState("");
  const [accionTexto, setAccionTexto] = useState("");
  const accion = useDiferido(accionTexto);
  const [entidad, setEntidad] = useState("");

  const p = usePaginado<Fila>(
    (desde, hasta) => {
      let q = supabase.from("auditoria")
        .select("id,accion,entidad,entidad_id,zona_madre,detalle,created_at,actor:profiles!auditoria_actor_fkey(display_name,email)", { count: "exact" });
      const l = busca.replace(/[,()*%\\"']/g, " ").trim();
      if (l) q = q.or(`accion.ilike.%${l}%,entidad.ilike.%${l}%,entidad_id.ilike.%${l}%`);
      if (zona) q = q.eq("zona_madre", zona);
      if (entidad) q = q.eq("entidad", entidad);
      // «contiene»: escribir «rol» encuentra asignar_rol y quitar_rol.
      const a = limpiarBusqueda(accion).replace(/ /g, "_");
      if (a) q = q.ilike("accion", `%${a}%`);
      q = rangoTimestamp(q, "created_at", diaDesde, diaHasta);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(desde, hasta)
        .then((r) => (r.error && faltaLote(r.error) ? { data: null, count: null, error: { message: "Falta el lote 63 en la base de datos." } } : r)) as
        PromiseLike<{ data: Fila[] | null; count: number | null; error: unknown }>;
    },
    [busca, zona, entidad, accion, diaDesde, diaHasta],
    30,
  );

  const activos = [diaDesde || diaHasta, accion.trim(), entidad].filter(Boolean).length;
  const quitarExtras = () => { setDiaDesde(""); setDiaHasta(""); setAccionTexto(""); setEntidad(""); };

  return (
    <SeccionPanel titulo="Auditoría" descripcion="Cada acción del equipo, con quién y cuándo. No se puede editar ni borrar." ancho="ancho">
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar acción, tipo o id…" />
        <select value={zona} onChange={(e) => setZona(e.target.value)} className={`${claseCampo} md:max-w-[220px]`} aria-label="Zona">
          <option value="">Todas las zonas</option>
          {ZONAS_MADRE.map((z) => <option key={z.clave} value={z.clave}>{z.label}</option>)}
        </select>
      </div>
      <div className="mb-4">
        <PanelFiltros clave="admin-auditoria" activos={activos} onLimpiar={quitarExtras}>
          <RangoFechas desde={diaDesde} hasta={diaHasta} onDesde={setDiaDesde} onHasta={setDiaHasta} />
          <CampoFiltro etiqueta="Acción">
            <input type="search" list="acciones-auditoria" value={accionTexto} onChange={(e) => setAccionTexto(e.target.value)}
              placeholder="Escribe o elige…" className={claseFiltro} />
            <datalist id="acciones-auditoria">
              {ACCIONES.map((x) => <option key={x} value={x} />)}
            </datalist>
          </CampoFiltro>
          <CampoFiltro etiqueta="Sobre qué">
            <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className={claseFiltro}>
              <option value="">Todo</option>
              {ENTIDADES.map((x) => <option key={x.clave} value={x.clave}>{x.label}</option>)}
            </select>
          </CampoFiltro>
        </PanelFiltros>
      </div>
      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio={busca || zona || activos > 0 ? "Ninguna acción con esos filtros." : "Aún no hay acciones registradas."} />
      <ul className="flex flex-col gap-2">
        {p.filas.map((f) => (
          <li key={f.id} className="rounded-xl border border-linea bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Etiqueta tono="marca">{f.accion.replace(/_/g, " ")}</Etiqueta>
              <Etiqueta>{f.entidad}</Etiqueta>
              {f.zona_madre && <Etiqueta>{f.zona_madre}</Etiqueta>}
              <span className="ml-auto text-sm text-tinta-suave">{new Date(f.created_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            <p className="mt-1 text-[15px]"><strong>{f.actor?.display_name || f.actor?.email || "Sistema"}</strong>
              {f.entidad_id && <span className="text-tinta-suave"> · {f.entidad_id}</span>}</p>
            {f.detalle && <p className="mt-1 break-all font-mono text-[13px] text-tinta-suave">{JSON.stringify(f.detalle)}</p>}
          </li>
        ))}
      </ul>
      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
    </SeccionPanel>
  );
}
