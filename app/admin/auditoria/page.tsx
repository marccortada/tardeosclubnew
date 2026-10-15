"use client";

import { useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, EstadoLista } from "@/components/panel/Paginacion";
import { Etiqueta } from "@/components/ui/Chip";
import { claseCampo } from "@/components/ui/Campo";
import { supabase } from "@/lib/supabase";
import { faltaLote, ZONAS_MADRE } from "@/components/admin/roles";

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

  const p = usePaginado<Fila>(
    (desde, hasta) => {
      let q = supabase.from("auditoria")
        .select("id,accion,entidad,entidad_id,zona_madre,detalle,created_at,actor:profiles!auditoria_actor_fkey(display_name,email)", { count: "exact" });
      const l = busca.replace(/[,()*%\\"']/g, " ").trim();
      if (l) q = q.or(`accion.ilike.%${l}%,entidad.ilike.%${l}%,entidad_id.ilike.%${l}%`);
      if (zona) q = q.eq("zona_madre", zona);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(desde, hasta)
        .then((r) => (r.error && faltaLote(r.error) ? { data: null, count: null, error: { message: "Falta el lote 63 en la base de datos." } } : r)) as
        PromiseLike<{ data: Fila[] | null; count: number | null; error: unknown }>;
    },
    [busca, zona],
    30,
  );

  return (
    <SeccionPanel titulo="Auditoría" descripcion="Cada acción del equipo, con quién y cuándo. No se puede editar ni borrar." ancho="ancho">
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar acción, tipo o id…" />
        <select value={zona} onChange={(e) => setZona(e.target.value)} className={`${claseCampo} md:max-w-[220px]`} aria-label="Zona">
          <option value="">Todas las zonas</option>
          {ZONAS_MADRE.map((z) => <option key={z.clave} value={z.clave}>{z.label}</option>)}
        </select>
      </div>
      <EstadoLista cargando={p.cargando} error={p.error} vacio="Aún no hay acciones registradas." filas={p.filas.length} />
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
