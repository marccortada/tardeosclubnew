"use client";

import { useCallback, useEffect, useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { claseCampo } from "@/components/ui/Campo";
import { supabase } from "@/lib/supabase";
import { usePermisosAdmin, faltaLote, TAREAS, ZONAS_MADRE } from "@/components/admin/roles";
import { X } from "lucide-react";

/**
 * Equipo de administración por zona y tarea (dossier pág. 15: Álex
 * Barcelona, Sergi Tarragona, Girona, Cristina sorteos).
 *
 * Solo el admin global asigna o quita. Asignar un rol da acceso al panel;
 * quitar el último lo retira (si no, quedaría como admin global). Todo pasa
 * por funciones del lote 69 que comprueban el permiso en el servidor y dejan
 * rastro en la auditoría.
 */
type Fila = { profile_id: string; email: string | null; nombre: string | null; rol_id: string | null; tarea: string; zona_madre: string | null; desde: string };

const nombreTarea = (t: string) => TAREAS.find((x) => x.clave === t)?.label ?? t;
const nombreZona = (z: string | null) => (z ? ZONAS_MADRE.find((x) => x.clave === z)?.label ?? z : "Todas");

export default function Equipo() {
  const permisos = usePermisosAdmin();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [ok, setOk] = useState("");
  const [email, setEmail] = useState("");
  const [tarea, setTarea] = useState("zona");
  const [zona, setZona] = useState("tarragona");
  const [obrando, setObrando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error: e } = await supabase.rpc("equipo_admin");
    setCargando(false);
    if (e) { setError(faltaLote(e) ? "Falta el lote 69 en la base de datos." : e.message); return; }
    setError(null);
    setFilas((data ?? []) as Fila[]);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const asignar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setAviso(""); setOk("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setAviso("Escribe un email válido."); return; }
    setObrando(true);
    const { error: e } = await supabase.rpc("admin_asignar_rol", {
      p_email: email.trim(), p_tarea: tarea, p_zona_madre: tarea === "global" ? null : zona || null,
    });
    setObrando(false);
    if (e) { setAviso(e.message); return; }
    setOk(`Permiso asignado a ${email.trim()}.`);
    setEmail("");
    cargar();
  };

  const quitar = async (f: Fila) => {
    if (!f.rol_id) return;
    if (!confirm(`¿Quitar «${nombreTarea(f.tarea)} · ${nombreZona(f.zona_madre)}» a ${f.email}? Si era su último permiso, deja de ser admin.`)) return;
    setAviso(""); setOk("");
    const { error: e } = await supabase.rpc("admin_quitar_rol", { p_rol: f.rol_id });
    if (e) { setAviso(e.message); return; }
    setOk("Permiso quitado.");
    cargar();
  };

  return (
    <SeccionPanel
      titulo="Equipo"
      descripcion="Quién administra cada zona y cada tarea. Un admin sin permisos asignados es global (como hasta ahora)."
    >
      {!permisos.cargando && !permisos.global && (
        <Aviso tono="aviso">Solo un administrador global puede cambiar el equipo. Aquí ves quién hay.</Aviso>
      )}
      {aviso && <Aviso>{aviso}</Aviso>}
      {ok && <Aviso tono="ok">{ok}</Aviso>}

      {permisos.global && !permisos.sinLote && (
        <form onSubmit={asignar} className="mb-6 grid gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:grid-cols-[1fr_180px_180px_auto] md:items-end">
          <label className="text-[15px] font-semibold">Email de la cuenta
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@ejemplo.com"
              className={`${claseCampo} mt-1`} autoComplete="off" />
          </label>
          <label className="text-[15px] font-semibold">Tarea
            <select value={tarea} onChange={(e) => setTarea(e.target.value)} className={`${claseCampo} mt-1`}>
              {TAREAS.map((t) => <option key={t.clave} value={t.clave}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-[15px] font-semibold">Zona
            <select value={tarea === "global" ? "" : zona} disabled={tarea === "global"} onChange={(e) => setZona(e.target.value)} className={`${claseCampo} mt-1`}>
              <option value="">Todas</option>
              {ZONAS_MADRE.map((z) => <option key={z.clave} value={z.clave}>{z.label}</option>)}
            </select>
          </label>
          <Boton type="submit" cargando={obrando}>Asignar</Boton>
        </form>
      )}

      <EstadoLista cargando={cargando} error={error} vacio="No hay nadie en el equipo." filas={filas.length} />
      {filas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => (
            <li key={`${f.profile_id}-${f.rol_id ?? "global"}`} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-linea bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{f.nombre || f.email}</p>
                <p className="truncate text-sm text-tinta-suave">{f.email}</p>
              </div>
              <Etiqueta>{nombreTarea(f.tarea)}</Etiqueta>
              {f.tarea !== "global" && <Etiqueta>{nombreZona(f.zona_madre)}</Etiqueta>}
              {permisos.global && f.rol_id && (
                <button onClick={() => quitar(f)} aria-label={`Quitar permiso a ${f.email}`}
                  className="grid h-11 w-11 place-items-center rounded-lg text-tinta-suave hover:bg-marfil-100 hover:text-error">
                  <X size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-tinta-suave">
        Sin fila de permisos = admin global (sin asignar). Cada cambio queda en <a href="/admin/auditoria" className="font-semibold text-magenta underline">Auditoría</a>.
      </p>
    </SeccionPanel>
  );
}
