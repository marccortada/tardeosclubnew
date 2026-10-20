"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clock, Ban, Loader2 } from "lucide-react";
import CabeceraApp from "@/components/CabeceraApp";
import Hoja from "@/components/ui/Hoja";
import TarjetaPlan from "@/components/tardicola/TarjetaPlan";
import { useAuth } from "@/lib/useAuth";
import { getProximaParada, setFavorito, type PlanGuardado } from "@/lib/tardeos";
import { retirarAsistencia } from "@/lib/tardicola";
import { hoyEnEspana } from "@/lib/fechas";

/**
 * Próxima Parada (dossier pág. 9): guardados y Asistiré, Próximos / Pasados,
 * con su estado. Dos acciones que NO se mezclan:
 *  - «Quitar» deja de guardar (con Deshacer: no se pierde nada).
 *  - «Ya no voy» retira el Asistiré, con confirmación: la plaza se pierde y al
 *    volver la base decide otra vez (si está lleno, a la lista de espera).
 */
export default function ProximaParada() {
  const { user, loading } = useAuth();
  const [planes, setPlanes] = useState<PlanGuardado[] | null>(null);
  const [error, setError] = useState("");
  const [pestana, setPestana] = useState<"proximos" | "pasados">("proximos");
  const [deshacer, setDeshacer] = useState<PlanGuardado | null>(null);
  const [noVoy, setNoVoy] = useState<PlanGuardado | null>(null);
  const [retirando, setRetirando] = useState(false);

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

  const ordenar = (l: PlanGuardado[]) => [...l].sort((a, b) => a.tardeo.fecha.localeCompare(b.tardeo.fecha));
  /** Cambia un plan de la lista; si ya no está guardado ni con Asistiré, sale. */
  const cambiar = (id: string, nuevo: PlanGuardado | null) =>
    setPlanes((l) => ordenar([...(l ?? []).filter((x) => x.tardeo.id !== id), ...(nuevo && (nuevo.guardado || nuevo.estado) ? [nuevo] : [])]));

  /** Quitar = solo dejar de guardar. El Asistiré, si lo hay, no se toca. Se puede deshacer. */
  const quitar = async (p: PlanGuardado) => {
    cambiar(p.tardeo.id, { ...p, guardado: false });
    setDeshacer(p);
    const r = await setFavorito(user.id, p.tardeo.id, false);
    if (r.error) {
      cambiar(p.tardeo.id, p);
      setDeshacer(null);
      setError("No se pudo quitar. Inténtalo otra vez.");
    }
  };
  const deshacerQuitar = async () => {
    const p = deshacer;
    if (!p) return;
    setDeshacer(null);
    const r = await setFavorito(user.id, p.tardeo.id, true);
    if (r.error) { setError("No se pudo deshacer. Vuelve a guardarlo desde la ficha."); return; }
    setPlanes((l) => {
      const actual = (l ?? []).find((x) => x.tardeo.id === p.tardeo.id);
      return ordenar([...(l ?? []).filter((x) => x.tardeo.id !== p.tardeo.id), { ...(actual ?? p), guardado: true }]);
    });
  };

  /** Ya no voy = retirar el Asistiré (tras confirmar). Si estaba guardado, sigue guardado. */
  const confirmarNoVoy = async () => {
    const p = noVoy;
    if (!p) return;
    setRetirando(true);
    const r = await retirarAsistencia(user.id, p.tardeo.id);
    setRetirando(false);
    setNoVoy(null);
    if (r.error) { setError("No se pudo retirar tu Asistiré. Inténtalo otra vez."); return; }
    cambiar(p.tardeo.id, { ...p, estado: null });
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
                {/* Con Asistiré (y aún por llegar): «Ya no voy». Solo guardado: «Quitar». */}
                {p.estado && pestana === "proximos" && p.tardeo.estado !== "cancelado" ? (
                  <button type="button" onClick={() => setNoVoy(p)}
                    className="min-h-[44px] px-2 text-[15px] font-semibold text-tinta-suave underline underline-offset-2">Ya no voy</button>
                ) : p.guardado ? (
                  <button type="button" onClick={() => quitar(p)} aria-label={`Quitar ${p.tardeo.titulo} de guardados`}
                    className="min-h-[44px] px-2 text-[15px] font-semibold text-tinta-suave underline underline-offset-2">Quitar</button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {deshacer && (
        // bg-noche fijo (no bg-tinta, que en oscuro se aclara y dejaba el aviso
        // claro con letra clara). Va encima de la barra inferior y del
        // mini‑reproductor si suena música: cada uno publica su altura.
        <div role="status" className="fixed inset-x-3 bottom-[calc(var(--alto-barra-inferior,76px)+var(--alto-mini,0px)+8px)] z-[1001] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-noche px-4 py-3 text-white shadow-elevada md:bottom-6">
          <span className="truncate text-[15px]">Quitado de guardados: {deshacer.tardeo.titulo}</span>
          <button type="button" onClick={deshacerQuitar} className="min-h-[44px] shrink-0 font-bold text-oro">Deshacer</button>
        </div>
      )}

      <Hoja abierta={!!noVoy} onCerrar={() => !retirando && setNoVoy(null)} titulo="¿Ya no vas?"
        pie={
          <div className="flex flex-col gap-2">
            <button type="button" onClick={confirmarNoVoy} disabled={retirando}
              className="min-h-[52px] w-full rounded-2xl bg-error text-[17px] font-bold text-white disabled:opacity-60">
              {retirando ? "Retirando…" : "Sí, ya no voy"}
            </button>
            <button type="button" onClick={() => setNoVoy(null)} disabled={retirando}
              className="min-h-[48px] w-full text-[16px] font-semibold text-magenta-700 dark:text-magenta-400">
              {noVoy?.estado === "espera" ? "Seguir en la lista de espera" : "Mantener mi plaza"}
            </button>
          </div>
        }>
        {noVoy && (
          <div className="space-y-2 text-[16px] text-tinta">
            <p className="font-semibold">{noVoy.tardeo.titulo}</p>
            {noVoy.estado === "espera" ? (
              <p>Saldrás de la lista de espera y perderás tu turno.</p>
            ) : (
              <p>Perderás tu plaza. Si luego cambias de idea y ya está lleno, irías a la lista de espera.</p>
            )}
            {noVoy.guardado && <p className="text-tinta-suave">Seguirá en tus guardados.</p>}
          </div>
        )}
      </Hoja>
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
