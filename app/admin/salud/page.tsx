"use client";

import { useCallback, useEffect, useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { claseBoton } from "@/components/Boton";
import { revisarSalud, type Prueba } from "@/lib/salud";
import { ultimosFallos, traza } from "@/lib/registro";
import { supabase } from "@/lib/supabase";
import { Check, AlertTriangle, HelpCircle, RefreshCw, Stethoscope } from "lucide-react";

/** Códigos de «eso todavía no existe en la base» (los mismos que lib/salud). */
const NO_EXISTE = new Set(["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]);
const CERO = "00000000-0000-0000-0000-000000000000";

/**
 * Lotes 49 en adelante. Van aquí y no en lib/salud.ts para no pisar ese
 * fichero (lo tocan otras tareas); el formato es el mismo. Nada escribe: se
 * piden columnas con limit(0) o se llama a funciones con un id que no existe.
 */
async function pruebasNuevas(): Promise<Prueba[]> {
  const mirar = async (nombre: string, arreglo: string, pedir: () => PromiseLike<{ error: { code?: string; message?: string } | null }>): Promise<Prueba> => {
    try {
      const { error } = await pedir();
      if (!error) return { nombre, ok: true, detalle: "Correcto" };
      if (NO_EXISTE.has(error.code ?? "")) return { nombre, ok: false, detalle: "No existe todavía en la base.", arreglo };
      if (error.code === "42501") return { nombre, ok: true, detalle: "Protegido por permisos (correcto)." };
      return { nombre, ok: false, detalle: error.message ?? "Error desconocido.", arreglo };
    } catch (e) {
      return { nombre, ok: false, detalle: String(e), arreglo };
    }
  };
  return Promise.all([
    mirar("Botón con enlace en los popups (lote 49)", "Pega supabase/49_popups.sql",
      () => supabase.from("popups").select("cta_texto,cta_url,imagen_url").limit(0)),
    // El 50 cambia permisos internos que no se ven desde fuera; lo que sí se
    // ve es si sus funciones responden.
    mirar("Apuntados y métricas del local para el admin (lote 50)", "Pega supabase/50_panel_local_admin.sql",
      () => supabase.rpc("inscritos_de_local", { p_local: CERO })),
    Promise.resolve<Prueba>({
      nombre: "Borrar cuentas sin que lo bloquee la base (lote 52)", ok: true, sinComprobar: true,
      detalle: "Solo cambia claves ajenas: no se ve desde la web.",
      arreglo: "Si al borrar un usuario sale «la base de datos no deja borrar», pega supabase/52_borrar_cuenta.sql.",
    }),
    mirar("Series de tardeos (lote 53)", "Pega supabase/53_series.sql",
      () => supabase.from("tardeos").select("serie_id").limit(0)),
    mirar("Estadísticas por tardeo (lote 54)", "Pega supabase/54_metricas_por_tardeo.sql",
      () => supabase.rpc("metricas_por_tardeo", { p_local: CERO, p_dias: 7 })),
    mirar("Invitaciones de DJ (lote 55)", "Pega supabase/55_invitaciones_dj.sql",
      () => supabase.from("dj_invitaciones").select("id").limit(0)),
    mirar("Incidencias y errores automáticos (lote 57)", "Pega supabase/57_incidencias_y_errores.sql",
      () => supabase.from("errores_app").select("huella,veces,resuelto").limit(0)
        .then(async (r) => (r.error ? r : await supabase.from("incidencias").select("id,estado,nota_admin").limit(0)))),
  ]);
}

/**
 * Si algo está mal, aquí se ve. Y se ve QUÉ.
 *
 * El fallo que más veces se ha repetido en este proyecto no revienta nada: es
 * un lote de SQL sin pegar. La pantalla afectada se esconde sola —está escrita
 * para eso— y el problema se descubre semanas después mirando otra cosa. Esta
 * pantalla convierte «algo va raro» en «falta pegar el lote 41».
 */
export default function AdminSalud() {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const revisar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const [{ pruebas }, nuevas] = await Promise.all([revisarSalud(), pruebasNuevas()]);
      setPruebas([...pruebas, ...nuevas]);
    } catch (e) {
      setError("No se pudo completar la revisión: " + String(e));
    }
    setCargando(false);
  }, []);
  useEffect(() => { revisar(); }, [revisar]);

  const mal = pruebas.filter((p) => !p.ok);
  const dudas = pruebas.filter((p) => p.sinComprobar);
  const fallos = ultimosFallos();
  // Lo que está mal, primero; luego lo que no se pudo comprobar; al final lo correcto.
  const peso = (p: Prueba) => (!p.ok ? 0 : p.sinComprobar ? 1 : 2);

  return (
    <SeccionPanel
      titulo="Salud"
      descripcion={
        cargando ? "Comprobando cada pieza…"
          : error ? error
          : mal.length === 0
            ? `Todo correcto${dudas.length ? ` (${dudas.length} sin poder comprobar)` : ""}.`
            : `${mal.length} ${mal.length === 1 ? "cosa que mirar" : "cosas que mirar"}.`
      }
      acciones={
        <button type="button" onClick={revisar} disabled={cargando} className={claseBoton("contorno", "pequeno")}>
          <RefreshCw size={18} className={cargando ? "animate-spin" : ""} aria-hidden /> Volver a mirar
        </button>
      }
      ancho="estrecho"
    >
      {cargando && pruebas.length === 0 ? (
        <div className="flex flex-col gap-2" aria-busy>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[64px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
        </div>
      ) : (
        <ul className={`flex flex-col gap-2 ${cargando ? "opacity-60" : ""}`}>
          {[...pruebas].sort((a, b) => peso(a) - peso(b)).map((p) => {
            const tono = !p.ok ? "border-aviso/30 bg-aviso-fondo" : p.sinComprobar ? "border-linea-fuerte border-dashed bg-white" : "border-linea bg-white";
            return (
              <li key={p.nombre} className={`flex items-start gap-3 rounded-2xl border p-4 ${tono}`}>
                {!p.ok
                  ? <AlertTriangle size={20} className="mt-0.5 shrink-0 text-aviso" aria-label="Fallo" />
                  : p.sinComprobar
                    ? <HelpCircle size={20} className="mt-0.5 shrink-0 text-tinta-suave" aria-label="Sin comprobar" />
                    : <Check size={20} className="mt-0.5 shrink-0 text-ok" aria-label="Correcto" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-tight">{p.nombre}</p>
                  <p className="text-[15px] text-tinta-suave">{p.detalle}</p>
                  {p.arreglo && <p className={`mt-1 text-[15px] font-semibold ${p.ok ? "text-tinta-suave" : "text-aviso"}`}>{p.arreglo}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Los fallos de esta sesión. No es un registro de verdad —eso vive en
          el servidor— pero enseña lo que ha pasado mientras esta pestaña estaba
          abierta, que es lo que hace falta para reproducir algo que acaba de fallar. */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Stethoscope size={18} className="text-magenta" aria-hidden /> Fallos en esta pestaña
        </h2>
        {fallos.length === 0 ? (
          <p className="rounded-2xl border border-linea bg-white p-4 text-[15px] text-tinta-suave">Ninguno desde que abriste la página.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fallos.map((f, i) => (
              <li key={i} className="rounded-xl border border-linea bg-white p-3 text-[15px]">
                <span className="font-semibold text-magenta-700">{f.area}</span>{" "}
                <span className="text-tinta-suave">{new Date(f.cuando).toLocaleTimeString("es-ES")}</span>
                <span className="block text-tinta-suave">{f.mensaje}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-tinta-suave">
          Marca de esta sesión: <b className="text-tinta">{traza()}</b>. Cítala si nos pides que miremos algo.
        </p>
      </section>
    </SeccionPanel>
  );
}
