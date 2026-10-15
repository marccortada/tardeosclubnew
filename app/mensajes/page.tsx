"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver } from "@/lib/volver";
import Boton from "@/components/Boton";
import Conversacion from "@/components/comunidad/Conversacion";
import { COLS_SOLICITUD, ESTADO_SOLICITUD, type Solicitud } from "@/lib/mensajes";
import { fechaCorta, textoError } from "@/lib/meet";

/** Mis conversaciones con DJs (solicitudes enviadas y las aceptadas). */
export default function MisMensajes() {
  const { user, loading } = useAuth();
  const [filas, setFilas] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from("solicitudes_mensaje").select(COLS_SOLICITUD)
      .eq("de", uid).order("created_at", { ascending: false }).limit(50);
    if (error) { setError(textoError(error)); setFilas([]); return; }
    setFilas((data as unknown as Solicitud[]) ?? []);
  }, []);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar(user.id);
    // ?c=<id> llega desde el aviso de la campana: se abre esa conversación.
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) setAbierta(c);
  }, [user, cargar]);

  return (
    <div className="min-h-[70vh] bg-fondo">
      <header className="sticky top-0 z-[700] flex items-center gap-2 border-b border-linea bg-superficie/95 px-2 py-1.5 backdrop-blur">
        <Link href="/perfil" aria-label="Volver" className="grid min-h-tacto min-w-tacto place-items-center rounded-full hover:bg-marfil-100"><ArrowLeft size={22} aria-hidden /></Link>
        <h1 className="flex-1 text-lg font-bold">Mis mensajes</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-3 px-4 py-5">
        {loading ? null : !user ? (
          <div className="space-y-4 rounded-2xl border border-linea bg-superficie p-5">
            <p className="text-[16px]">Entra para ver tus conversaciones con DJs.</p>
            <Boton href={entrarYVolver("/mensajes")} ancho>Entrar</Boton>
          </div>
        ) : filas === null ? (
          <p className="grid place-items-center py-12 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p>
        ) : error ? (
          <p role="alert" className="rounded-2xl bg-error-fondo p-4 text-[15px] text-error">{error}</p>
        ) : filas.length === 0 ? (
          <div className="rounded-2xl border border-linea bg-superficie p-5 text-center">
            <p className="text-[16px]">Aún no has escrito a ningún DJ.</p>
            <p className="mt-1 text-[15px] text-tinta-suave">Abre el perfil de un DJ y pulsa Mensaje.</p>
            <Boton href="/djs" variante="contorno" className="mt-4">Ver DJs</Boton>
          </div>
        ) : filas.map((s) => {
          const nombre = s.djs?.nombre_artistico ?? "DJ";
          const open = abierta === s.id;
          return (
            <section key={s.id} className="rounded-2xl border border-linea bg-superficie">
              <button type="button" onClick={() => setAbierta(open ? null : s.id)} aria-expanded={open}
                className="flex min-h-tacto w-full items-center gap-3 px-4 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold">{nombre}</span>
                  <span className="block truncate text-[14px] text-tinta-suave">{s.texto}</span>
                </span>
                <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${s.estado === "aceptada" ? "bg-ok-fondo text-ok" : s.estado === "pendiente" ? "bg-aviso-fondo text-aviso" : "bg-marfil-100 text-tinta-suave"}`}>
                  {ESTADO_SOLICITUD[s.estado]}
                </span>
                {open ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
              </button>
              {open && (
                <div className="border-t border-linea px-4 pb-4">
                  {s.estado === "aceptada" ? (
                    <Conversacion conversacion={s.id} yo={user.id} nombreOtro={nombre} activa
                      primero={{ autor: s.de, texto: s.texto, created_at: s.created_at }} />
                  ) : (
                    <p className="py-3 text-[15px] text-tinta-suave">
                      {s.estado === "pendiente"
                        ? `Enviada el ${fechaCorta(s.created_at)}. Te avisaremos cuando ${nombre} responda.`
                        : `${nombre} no ha aceptado la conversación.`}
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
