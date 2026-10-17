"use client";

import { useState } from "react";
import Link from "next/link";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { claseCampo } from "@/components/ui/Campo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { faltaLote, ZONAS_MADRE, usePermisosAdmin } from "@/components/admin/roles";
import { ChevronRight } from "lucide-react";

/**
 * Cola de trabajo unificada (dossier pág. 15): validación profesional,
 * evento propuesto, vínculo DJ, duplicados, denuncias, ayuda, prestación
 * comercial y reclamaciones, con responsable, estado, fecha y zona.
 *
 * La resolución de cada cosa sigue en su pantalla (enlace "Abrir"): aquí se
 * reparte el trabajo. Asignar no toca las tablas de origen, va a
 * `asignaciones` (lote 69) y deja rastro en la auditoría. Un admin de zona
 * solo ve lo de su zona y lo que no tiene zona.
 */
type Fila = {
  tipo: string; objeto_id: string; titulo: string; detalle: string | null; zona_madre: string | null;
  fecha: string | null; enlace: string | null; responsable: string | null; responsable_nombre: string | null;
  estado: string; nota: string | null; total: number;
};

const TIPOS: Record<string, string> = {
  validacion: "Validación profesional", evento_propuesto: "Evento propuesto", vinculo_dj: "Vínculo DJ",
  duplicado: "Duplicado", denuncia_flyer: "Denuncia de flyer", denuncia: "Denuncia", ayuda: "Ayuda / incidencia",
  comercial: "Prestación comercial", reclamacion: "Reclamación de ficha",
};
const ESTADOS: Record<string, { label: string; tono: "neutro" | "aviso" | "ok" | "error" }> = {
  pendiente: { label: "Pendiente", tono: "aviso" }, en_curso: { label: "En curso", tono: "neutro" },
  hecho: { label: "Hecho", tono: "ok" }, descartado: { label: "Descartado", tono: "error" },
};

export default function Cola() {
  const { user } = useAuth();
  const permisos = usePermisosAdmin();
  const [tipo, setTipo] = useState("");
  const [zona, setZona] = useState("");
  const [estado, setEstado] = useState<"abiertas" | "todas" | "hecho">("abiertas");
  const [mias, setMias] = useState(false);
  const [aviso, setAviso] = useState("");

  const p = usePaginado<Fila>(
    (desde, hasta) =>
      supabase.rpc("cola_trabajo", {
        p_tipo: tipo || null, p_zona: zona || null, p_solo_mias: mias, p_estado: estado,
        p_limite: hasta - desde + 1, p_desde: desde,
      }).then(async ({ data, error }) => {
        if (error) return { data: null, count: null, error: faltaLote(error) ? { message: "Falta el lote 69 en la base de datos." } : error };
        const filas = (data ?? []) as Fila[];
        // Página vacía (se marcó hecho lo último de la última): no hay fila de la
        // que leer el total. El lote 73 da `cola_trabajo_total`; sin él, el apaño de abajo.
        if (filas.length === 0 && desde > 0) {
          const t = await supabase.rpc("cola_trabajo_total", { p_tipo: tipo || null, p_zona: zona || null, p_solo_mias: mias, p_estado: estado });
          if (!t.error) return { data: filas, count: Number(t.data ?? 0), error: null };
        }
        const limite = hasta - desde + 1;
        // El total viene en cada fila: con la página vacía (p. ej. se marcó
        // hecho lo último de la última página) no hay fila de la que leerlo y
        // salía «No hay nada pendiente» sin paginación. Se garantiza al menos
        // lo ya visto (`desde` filas antes de esta página) para que
        // usePaginado retroceda a la anterior. Si el total de la RPC se queda
        // corto (menos de lo visto), se usa lo visto y, con la página llena,
        // una más para poder pasar a la siguiente. Si el total cuadra (cuando
        // el SQL lo arregle), se usa tal cual.
        const visto = desde + filas.length;
        const totalRpc = Number(filas[0]?.total ?? 0);
        const count = totalRpc >= visto ? totalRpc : visto + (filas.length === limite ? 1 : 0);
        return { data: filas, count, error: null };
      }),
    [tipo, zona, estado, mias],
    25,
  );

  const cambiar = async (f: Fila, cambio: { responsable?: string | null; estado?: string }) => {
    setAviso("");
    const responsable = cambio.responsable !== undefined ? cambio.responsable : f.responsable;
    const nuevo = cambio.estado ?? (f.estado === "pendiente" ? "en_curso" : f.estado);
    const { error } = await supabase.rpc("asignar_cola", {
      p_tipo: f.tipo, p_objeto: f.objeto_id, p_responsable: responsable, p_estado: nuevo, p_nota: null,
    });
    if (error) { setAviso(error.message); return; }
    p.recargar();
  };

  return (
    <SeccionPanel titulo="Cola de trabajo" descripcion="Todo lo pendiente en un sitio, con quién lo lleva. Cada cambio deja rastro." ancho="ancho">
      {aviso && <Aviso>{aviso}</Aviso>}
      <div className="mb-4 flex flex-col gap-3">
        <Filtros
          opciones={[{ clave: "abiertas", label: "Abiertas" }, { clave: "hecho", label: "Hechas" }, { clave: "todas", label: "Todas" }] as { clave: "abiertas" | "todas" | "hecho"; label: string }[]}
          valor={estado} onCambiar={setEstado} />
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={claseCampo} aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={zona} onChange={(e) => setZona(e.target.value)} className={claseCampo} aria-label="Zona">
            <option value="">{permisos.global ? "Todas las zonas" : "Mis zonas"}</option>
            {ZONAS_MADRE.filter((z) => permisos.zonas === null || permisos.zonas.includes(z.clave))
              .map((z) => <option key={z.clave} value={z.clave}>{z.label}</option>)}
          </select>
          <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-linea-fuerte bg-white px-3 text-[15px]">
            <input type="checkbox" checked={mias} onChange={(e) => setMias(e.target.checked)} className="h-5 w-5 accent-magenta" />
            Solo asignadas a mí
          </label>
        </div>
      </div>

      <EstadoLista cargando={p.cargando} error={p.error} vacio="No hay nada pendiente con estos filtros." filas={p.filas.length} />
      <ul className="flex flex-col gap-2">
        {p.filas.map((f) => {
          const est = ESTADOS[f.estado] ?? ESTADOS.pendiente;
          const esMia = f.responsable === user?.id;
          return (
            <li key={`${f.tipo}-${f.objeto_id}`} className="rounded-xl border border-linea bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta tono="marca">{TIPOS[f.tipo] ?? f.tipo}</Etiqueta>
                <Etiqueta tono={est.tono}>{est.label}</Etiqueta>
                <Etiqueta>{f.zona_madre ? ZONAS_MADRE.find((z) => z.clave === f.zona_madre)?.label ?? f.zona_madre : "Sin zona"}</Etiqueta>
                <span className="ml-auto text-sm text-tinta-suave">{f.fecha ? new Date(f.fecha).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }) : ""}</span>
              </div>
              <p className="mt-2 text-[16px] font-bold">{f.titulo}</p>
              {f.detalle && <p className="text-[15px] text-tinta-suave">{f.detalle}</p>}
              <p className="mt-1 text-sm text-tinta-suave">Responsable: <strong>{f.responsable_nombre ?? "sin asignar"}</strong></p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!esMia && <Boton tamano="pequeno" onClick={() => cambiar(f, { responsable: user?.id ?? null })}>Asignarme</Boton>}
                {/* Soltar solo quita el responsable: una tarea hecha o descartada
                    sigue así (antes volvía a «Pendiente» y reaparecía en Abiertas). */}
                {esMia && <Boton tamano="pequeno" variante="contorno" onClick={() => cambiar(f, {
                  responsable: null, estado: f.estado === "hecho" || f.estado === "descartado" ? f.estado : "pendiente",
                })}>Soltar</Boton>}
                {f.estado !== "hecho" && <Boton tamano="pequeno" variante="suave" onClick={() => cambiar(f, { estado: "hecho" })}>Marcar hecho</Boton>}
                {f.estado === "hecho" && <Boton tamano="pequeno" variante="suave" onClick={() => cambiar(f, { estado: "pendiente" })}>Reabrir</Boton>}
                {f.enlace && (
                  <Link href={f.enlace} className="inline-flex min-h-[40px] items-center gap-1 px-2 text-[15px] font-semibold text-magenta">
                    Abrir <ChevronRight size={16} aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
    </SeccionPanel>
  );
}
