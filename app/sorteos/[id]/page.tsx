"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Gift, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver } from "@/lib/volver";
import Boton, { claseBoton } from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import { CabeceraApp, Mensaje } from "@/components/retorno/Piezas";
import { COLS_SORTEO, abiertoAhora, fechaLarga, participar, yaParticipo, type Sorteo } from "@/lib/sorteos";
import { faltaLote } from "@/lib/encuestas";
import { mensajeAmable } from "@/lib/mensajeError";

/** Ficha de un sorteo (vídeo hoja3/hoja4): imagen, premio, bases, Participar. */
export default function FichaSorteo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const [s, setS] = useState<Sorteo | null | undefined>(undefined);
  const [dentro, setDentro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verBases, setVerBases] = useState(false);
  // Fallo al leer (sin red, sesión caducada…) ≠ «no existe». Antes cualquier
  // error decía «Este sorteo no existe» y la persona no sabía que podía
  // reintentar. `intento` sube con «Reintentar» y vuelve a lanzar la lectura.
  const [falloCarga, setFalloCarga] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    supabase.from("sorteos").select(COLS_SORTEO).eq("id", id).maybeSingle()
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) { setFalloCarga(faltaLote(e) ? "Esta sección aún no está disponible." : mensajeAmable(e)); setS(undefined); return; }
        setFalloCarga(null);
        setS((data as Sorteo | null) ?? null);
      });
    return () => { vivo = false; };
  }, [id, intento]);
  useEffect(() => { if (user) yaParticipo(id, user.id).then(setDentro); }, [id, user]);

  const pulsar = async () => {
    setEnviando(true); setError(null);
    try { await participar(id); setDentro(true); }
    catch (e) { setError(e instanceof Error ? mensajeAmable(e) : "No se pudo registrar. Inténtalo otra vez."); }
    finally { setEnviando(false); }
  };

  if (falloCarga) return (
    <div className="min-h-dvh bg-white"><CabeceraApp titulo="Sorteos" volver="/sorteos" />
      <main className="mx-auto max-w-lg px-4 pt-6">
        <Mensaje icono={<Gift size={26} aria-hidden />} titulo="No se ha podido cargar el sorteo"><p role="alert">{falloCarga}</p></Mensaje>
        <Boton ancho variante="contorno" onClick={() => { setFalloCarga(null); setIntento((n) => n + 1); }}>Reintentar</Boton>
      </main>
    </div>
  );
  if (s === undefined) return <div className="min-h-dvh bg-white"><CabeceraApp titulo="Sorteos" volver="/sorteos" /><p className="py-10 text-center text-tinta-suave">Cargando…</p></div>;
  if (s === null) return <div className="min-h-dvh bg-white"><CabeceraApp titulo="Sorteos" volver="/sorteos" /><main className="mx-auto max-w-lg px-4 pt-6"><Mensaje icono={<Gift size={26} aria-hidden />} titulo="Este sorteo no existe" /></main></div>;

  const abierto = abiertoAhora(s);
  return (
    <div className="min-h-dvh bg-white pb-28">
      <CabeceraApp titulo="Sorteos" volver="/sorteos" />
      <main className="mx-auto max-w-lg px-4 pt-4">
        {s.imagen_url
          // eslint-disable-next-line @next/next/no-img-element -- imagen de Storage o externa
          ? <img src={s.imagen_url} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />
          : <div className="grid aspect-[16/9] w-full place-items-center rounded-2xl bg-magenta-50 text-magenta"><Gift size={56} aria-hidden /></div>}
        <h2 className="mt-4 text-[26px] font-bold leading-tight">{s.titulo}</h2>
        <p className="mt-1 text-[16px] text-tinta-suave">{s.premio}</p>
        {s.descripcion && <p className="mt-3 text-[16px]">{s.descripcion}</p>}

        <div className="mt-4 rounded-2xl border border-linea bg-white p-4">
          <p className="text-[15px]">Participa con tu cuenta. Consulta las bases, el premio y la fecha de cierre.</p>
          <p className="mt-2 text-[14px] text-tinta-suave">Cierra el {fechaLarga(s.cierra)}.</p>
          <button onClick={() => setVerBases(true)} className="mt-2 min-h-[44px] text-[15px] font-semibold text-magenta">Ver bases</button>
        </div>

        <div className="mt-4">
          {s.estado === "resuelto" ? (
            <div className="flex items-center gap-3 rounded-2xl bg-oro/20 p-4">
              <Trophy size={28} className="text-tinta" aria-hidden />
              <p className="text-[16px]"><b>Ganador:</b> {s.ganador_alias}</p>
            </div>
          ) : loading ? null : !user ? (
            abierto && <Link href={entrarYVolver(`/sorteos/${id}`)} className={claseBoton("primario", "normal", true)}>Entra para participar</Link>
          ) : dentro ? (
            <Boton ancho disabled><CheckCircle2 size={20} aria-hidden /> Participación registrada</Boton>
          ) : abierto ? (
            <Boton ancho cargando={enviando} onClick={pulsar}>Participar</Boton>
          ) : (
            <p className="rounded-2xl bg-marfil-100 p-4 text-[15px] font-semibold">
              {new Date(s.abre) > new Date() ? `Se abre el ${fechaLarga(s.abre)}.` : "Las participaciones están cerradas."}
            </p>
          )}
          {error && <p role="alert" className="mt-3 rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
          {s.estado !== "resuelto" && <p className="mt-3 text-[15px] text-tinta-suave">El equipo revisará las participaciones y publicará el ganador.</p>}
        </div>
      </main>
      <Hoja abierta={verBases} onCerrar={() => setVerBases(false)} titulo="Bases del sorteo">
        <div className="whitespace-pre-line text-[15px] leading-relaxed">
          <p><b>Premio:</b> {s.premio}</p>
          <p><b>Participación:</b> del {fechaLarga(s.abre)} al {fechaLarga(s.cierra)}. Una por cuenta registrada.</p>
          {s.bases ? <p className="mt-3">{s.bases}</p> : <p className="mt-3 text-tinta-suave">Las bases completas se publicarán aquí.</p>}
        </div>
      </Hoja>
    </div>
  );
}
