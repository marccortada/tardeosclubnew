"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clock, Ban, Loader2 } from "lucide-react";
import CabeceraApp from "@/components/CabeceraApp";
import TarjetaPlan from "@/components/tardicola/TarjetaPlan";
import { useAuth } from "@/lib/useAuth";
import { getProximaParada, setFavorito, type PlanGuardado } from "@/lib/tardeos";
import { retirarAsistencia, asistire } from "@/lib/tardicola";
import { hoyEnEspana } from "@/lib/fechas";

/**
 * Próxima Parada (dossier pág. 9): guardados y Asistiré, Próximos / Pasados,
 * con su estado y quitar con Deshacer. Abre la misma ficha.
 */
export default function ProximaParada() {
  const { user, loading } = useAuth();
  const [planes, setPlanes] = useState<PlanGuardado[] | null>(null);
  const [error, setError] = useState("");
  const [pestana, setPestana] = useState<"proximos" | "pasados">("proximos");
  const [deshacer, setDeshacer] = useState<PlanGuardado | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("pestana") === "pasados") setPestana("pasados");
  }, []);
  useEffect(() => {
    if (!user) return;
    getProximaParada(user.id).then(setPlanes).catch(() => setError("No pudimos cargar tus planes. Inténtalo otra vez."));
  }, [user]);

  if (loading) return <Cargando />;
  if (!user) {
    return (
      <main className="bg-fondo">
        <CabeceraApp titulo="Próxima Parada" />
        <div className="mx-auto max-w-md px-4 py-10 text-center">
          <p className="text-[20px] font-bold text-tinta">Tus planes guardados, a mano</p>
          <p className="mt-2 text-[16px] text-tinta-suave">Entra para guardar planes y confirmar que asistes.</p>
          <Link href="/perfil?volver=/proxima-parada" className="mt-5 inline-flex min-h-[48px] items-center rounded-2xl bg-magenta px-6 font-bold text-white">Entrar</Link>
        </div>
      </main>
    );
  }

  const hoy = hoyEnEspana();
  const visibles = (planes ?? []).filter((p) => (pestana === "proximos" ? p.tardeo.fecha >= hoy : p.tardeo.fecha < hoy));
  if (pestana === "pasados") visibles.reverse();

  /** Quitar = dejar de guardar y retirar el Asistiré. Se puede deshacer. */
  const quitar = async (p: PlanGuardado) => {
    setPlanes((l) => (l ?? []).filter((x) => x.tardeo.id !== p.tardeo.id));
    setDeshacer(p);
    const r1 = p.guardado ? await setFavorito(user.id, p.tardeo.id, false) : { error: null };
    const r2 = p.estado ? await retirarAsistencia(user.id, p.tardeo.id) : { error: null };
    if (r1.error || r2.error) {
      setPlanes((l) => [...(l ?? []), p].sort((a, b) => a.tardeo.fecha.localeCompare(b.tardeo.fecha)));
      setDeshacer(null);
      setError("No se pudo quitar. Inténtalo otra vez.");
    }
  };
  const deshacerQuitar = async () => {
    const p = deshacer;
    if (!p) return;
    setDeshacer(null);
    if (p.guardado) await setFavorito(user.id, p.tardeo.id, true);
    // Al volver a pulsar Asistiré la base decide de nuevo (puede tocar espera).
    let estado = p.estado;
    if (p.estado) estado = (await asistire(user.id, p.tardeo.id)).r?.estado === "espera" ? "espera" : "apuntado";
    setPlanes((l) => [...(l ?? []), { ...p, estado }].sort((a, b) => a.tardeo.fecha.localeCompare(b.tardeo.fecha)));
  };

  return (
    <main className="bg-fondo">
      <CabeceraApp titulo="Próxima Parada" />
      <div className="mx-auto max-w-3xl px-4 pt-4 md:pt-8">
        <h1 className="hidden text-[34px] font-bold text-tinta md:block">Próxima Parada</h1>
        <p className="text-[16px] text-tinta-suave">Tus planes guardados, a mano.</p>
        <div className="mt-3 flex gap-1 rounded-2xl bg-marfil-100 p-1" role="tablist">
          {(["proximos", "pasados"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)}
              className={`min-h-[44px] flex-1 rounded-xl text-[15px] font-semibold ${pestana === k ? "bg-magenta text-white" : "text-tinta"}`}>
              {k === "proximos" ? "Próximos" : "Pasados"}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-error-fondo px-3 py-2 text-[15px] font-semibold text-error">{error}</p>}
        {!planes && !error && <Cargando corto />}
        {planes && visibles.length === 0 && (
          <div className="mt-6 rounded-3xl border border-linea bg-superficie p-6 text-center">
            <p className="text-[18px] font-bold text-tinta">{pestana === "proximos" ? "Aún no tienes planes guardados" : "Sin planes pasados"}</p>
            <Link href="/eventos" className="mt-4 inline-flex min-h-[48px] items-center rounded-2xl bg-magenta px-6 font-bold text-white">Buscar planes</Link>
          </div>
        )}
        <ul className="mt-4 grid gap-5 sm:grid-cols-2">
          {visibles.map((p) => (
            <li key={p.tardeo.id}>
              <TarjetaPlan t={p.tardeo} />
              <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
                <Estado p={p} />
                <button type="button" onClick={() => quitar(p)} className="min-h-[44px] px-2 text-[15px] font-semibold text-tinta-suave underline underline-offset-2">Quitar</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {deshacer && (
        <div role="status" className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[1001] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-tinta px-4 py-3 text-fondo shadow-elevada md:bottom-6">
          <span className="truncate text-[15px]">Quitado: {deshacer.tardeo.titulo}</span>
          <button type="button" onClick={deshacerQuitar} className="min-h-[44px] shrink-0 font-bold text-oro">Deshacer</button>
        </div>
      )}
    </main>
  );
}

function Estado({ p }: { p: PlanGuardado }) {
  if (p.tardeo.estado === "cancelado") return <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-error"><Ban size={15} aria-hidden /> Cancelado</span>;
  if (p.estado === "apuntado") return <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-ok"><Check size={15} aria-hidden /> En lista · Confirmado</span>;
  if (p.estado === "espera") return <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-aviso"><Clock size={15} aria-hidden /> En espera</span>;
  return <span className="text-[14px] text-tinta-suave">Guardado</span>;
}

function Cargando({ corto }: { corto?: boolean }) {
  return <div className={`grid place-items-center ${corto ? "py-10" : "min-h-[50vh]"}`}><Loader2 className="animate-spin text-magenta" aria-label="Cargando" /></div>;
}
