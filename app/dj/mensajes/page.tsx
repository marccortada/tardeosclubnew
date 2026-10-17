"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver } from "@/lib/volver";
import Boton from "@/components/Boton";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Hoja from "@/components/ui/Hoja";
import { Filtros } from "@/components/panel/Paginacion";
import Conversacion from "@/components/comunidad/Conversacion";
import Denunciar from "@/components/comunidad/Denunciar";
import { responderSolicitud, limitarSolicitudes, type Solicitud } from "@/lib/mensajes";
import { fechaCorta, perfilesPublicos, textoError, type PerfilPublico } from "@/lib/meet";

type Pestana = "pendiente" | "aceptada" | "rechazada";

/**
 * Bandeja del DJ: solicitudes de mensaje (aceptar, rechazar, bloquear),
 * conversaciones abiertas y "pausar solicitudes nuevas" (limitar). Se carga
 * sola la ficha del DJ: no depende del panel /dj para funcionar.
 */
export default function BandejaDj() {
  const { user, loading } = useAuth();
  const [dj, setDj] = useState<{ id: string; nombre_artistico: string } | null | undefined>(undefined);
  const [acepta, setAcepta] = useState(true);
  const [pestana, setPestana] = useState<Pestana>("pendiente");
  const [filas, setFilas] = useState<Solicitud[] | null>(null);
  const [perfiles, setPerfiles] = useState<Record<string, PerfilPublico>>({});
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<Solicitud | null>(null);
  const [denunciar, setDenunciar] = useState<string | null>(null);

  // Última carga pedida: si se cambia de pestaña antes de que llegue la
  // anterior, la vieja se descarta y no pisa la lista nueva.
  const turno = useRef(0);

  useEffect(() => {
    if (!user) return;
    const c = new URLSearchParams(window.location.search).get("c");
    (async () => {
      const { data } = await supabase.from("djs").select("id,nombre_artistico").eq("profile_id", user.id)
        .order("created_at").limit(1).maybeSingle();
      const d = (data as { id: string; nombre_artistico: string } | null) ?? null;
      if (d && c) {
        // El aviso abre /dj/mensajes?c=<id>. Si esa solicitud ya está
        // aceptada (o rechazada), en «Pendientes» no sale y el DJ leía «No
        // tienes solicitudes pendientes». Se mira su estado y se abre su
        // pestaña ANTES de fijar el DJ, para que la primera carga ya sea esa.
        const { data: sol } = await supabase.from("solicitudes_mensaje").select("estado")
          .eq("id", c).eq("dj_id", d.id).maybeSingle();
        const est = (sol as { estado: string } | null)?.estado;
        if (est === "pendiente" || est === "aceptada" || est === "rechazada") setPestana(est);
        setAbierta(c);
      }
      setDj(d);
      if (d) {
        const { data: a } = await supabase.from("dj_mensajes_ajustes").select("acepta_solicitudes").eq("dj_id", d.id).maybeSingle();
        setAcepta((a as { acepta_solicitudes: boolean } | null)?.acepta_solicitudes ?? true);
      }
    })();
  }, [user]);

  const cargar = useCallback(async (djId: string, p: Pestana) => {
    const yo = ++turno.current;
    setFilas(null);
    const { data, error } = await supabase.from("solicitudes_mensaje").select("id,de,dj_id,texto,estado,respondida_en,created_at")
      .eq("dj_id", djId).eq("estado", p).order("created_at", { ascending: false }).limit(50);
    if (yo !== turno.current) return; // llegó tarde: hay otra más nueva
    if (error) { setError(textoError(error)); setFilas([]); return; }
    setError(null);
    const f = (data as Solicitud[]) ?? [];
    setFilas(f);
    const pp = await perfilesPublicos([...new Set(f.map((x) => x.de))]);
    setPerfiles((prev) => ({ ...prev, ...pp }));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (dj) cargar(dj.id, pestana);
  }, [dj, pestana, cargar]);

  async function responder(s: Solicitud, accion: "aceptar" | "rechazar" | "bloquear") {
    setOcupado(s.id); setError(null);
    const r = await responderSolicitud(s.id, accion);
    setOcupado(null); setConfirmar(null);
    if (r.error) { setError(textoError(r.error)); return; }
    if (accion === "aceptar") { setAbierta(s.id); setPestana("aceptada"); }
    else if (dj) cargar(dj.id, pestana);
  }

  async function cambiarLimite() {
    if (!dj) return;
    const r = await limitarSolicitudes(dj.id, !acepta);
    if (r.error) { setError(textoError(r.error)); return; }
    setAcepta(!acepta);
  }

  return (
    <>
      {/* Dentro del panel del DJ: su cabecera ya trae menú y título. Antes
          tenía otra cabecera fija propia con flecha y en móvil salían dos
          barras apiladas. */}
      <SeccionPanel titulo="Mensajes" ancho="estrecho">
      <div className="space-y-4">
        {loading || (user && dj === undefined) ? (
          <p className="grid place-items-center py-12 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p>
        ) : !user ? (
          <Boton href={entrarYVolver("/dj/mensajes")} ancho>Entrar</Boton>
        ) : !dj ? (
          <div className="rounded-2xl border border-linea bg-superficie p-5">
            <p className="text-[16px]">Esta bandeja es para DJs con perfil en Tardeos Club.</p>
            <Boton href="/unirse?rol=dj" variante="contorno" className="mt-4">Crear mi perfil de DJ</Boton>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px]">{acepta ? "Recibes solicitudes nuevas." : "Solicitudes nuevas en pausa. Las conversaciones abiertas siguen."}</p>
              <Boton tamano="pequeno" variante="contorno" onClick={cambiarLimite}>{acepta ? "Pausar solicitudes" : "Volver a recibir"}</Boton>
            </div>
            <Filtros<Pestana> valor={pestana} onCambiar={setPestana}
              opciones={[{ clave: "pendiente", label: "Pendientes" }, { clave: "aceptada", label: "Conversaciones" }, { clave: "rechazada", label: "Rechazadas" }]} />
            {error && <p role="alert" className="rounded-2xl bg-error-fondo p-3 text-[15px] text-error">{error}</p>}
            {filas === null ? (
              <p className="grid place-items-center py-8 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p>
            ) : filas.length === 0 ? (
              <p className="rounded-2xl border border-linea bg-superficie p-5 text-center text-[15px] text-tinta-suave">
                {pestana === "pendiente" ? "No tienes solicitudes pendientes." : pestana === "aceptada" ? "Aún no hay conversaciones." : "No hay solicitudes rechazadas."}
              </p>
            ) : filas.map((s) => {
              const quien = perfiles[s.de]?.alias ?? "Tardícola";
              return (
                <section key={s.id} className="rounded-2xl border border-linea bg-superficie p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold">{quien}</p>
                      <p className="text-[13px] text-tinta-suave">{fechaCorta(s.created_at)}</p>
                    </div>
                    <button type="button" onClick={() => setDenunciar(s.id)} className="min-h-[44px] px-2 text-[14px] text-tinta-suave underline">Denunciar</button>
                  </div>
                  {s.estado !== "aceptada" && <p className="mt-2 whitespace-pre-wrap text-[15px]">{s.texto}</p>}
                  {s.estado === "pendiente" && (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Boton tamano="pequeno" cargando={ocupado === s.id} onClick={() => responder(s, "aceptar")}>Aceptar</Boton>
                      <Boton tamano="pequeno" variante="contorno" disabled={ocupado === s.id} onClick={() => responder(s, "rechazar")}>Rechazar</Boton>
                      <Boton tamano="pequeno" variante="peligro" disabled={ocupado === s.id} onClick={() => setConfirmar(s)}>Bloquear</Boton>
                    </div>
                  )}
                  {s.estado === "aceptada" && (
                    abierta === s.id ? (
                      <>
                        <Conversacion conversacion={s.id} yo={user.id} nombreOtro={quien} activa
                          primero={{ autor: s.de, texto: s.texto, created_at: s.created_at }} />
                        <div className="mt-3 flex gap-2">
                          <Boton tamano="pequeno" variante="contorno" onClick={() => setAbierta(null)}>Cerrar</Boton>
                          <Boton tamano="pequeno" variante="peligro" onClick={() => setConfirmar(s)}>Bloquear</Boton>
                        </div>
                      </>
                    ) : (
                      <Boton tamano="pequeno" variante="contorno" className="mt-3" onClick={() => setAbierta(s.id)}>Abrir conversación</Boton>
                    )
                  )}
                  {s.estado === "rechazada" && (
                    <Boton tamano="pequeno" variante="contorno" className="mt-3" onClick={async () => {
                      const r = await responderSolicitud(s.id, "desbloquear");
                      setError(r.error ? textoError(r.error) : null);
                    }}>Desbloquear (si estaba bloqueado)</Boton>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>
      </SeccionPanel>
      <Hoja abierta={!!confirmar} onCerrar={() => setConfirmar(null)} titulo="¿Bloquear?"
        pie={<Boton variante="peligro" ancho cargando={!!ocupado} onClick={() => confirmar && responder(confirmar, "bloquear")}>Bloquear</Boton>}>
        <p className="text-[16px]">No podrá enviarte más solicitudes ni mensajes. Puedes desbloquear más tarde desde Rechazadas.</p>
      </Hoja>
      {denunciar && <Denunciar abierta onCerrar={() => setDenunciar(null)} tipo="mensaje_dj" objetoId={denunciar} />}
    </>
  );
}
