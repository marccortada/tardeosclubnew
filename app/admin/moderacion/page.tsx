"use client";

import { useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { getResenasPendientes, moderarResena, MOTIVOS_RECHAZO, etiquetaMotivo,
  type MotivoRechazo, type Resena } from "@/lib/resenas";
import { Check, X, Star, Loader2, Flag, AlertTriangle, ExternalLink } from "lucide-react";
import { denunciasPendientes, resolverDenuncia, MOTIVOS, type Denuncia } from "@/lib/denuncias";
import Link from "next/link";

export default function AdminModeracion() {
  const [tab, setTab] = useState<"resenas" | "flyers">("resenas");
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [moderando, setModerando] = useState<string | null>(null);
  const [errorR, setErrorR] = useState<string | null>(null);
  /** Cuál está con el motivo de rechazo abierto. */
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [errorD, setErrorD] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<string | null>(null);

  useEffect(() => {
    getResenasPendientes().then((r) => { setResenas(r); setCargando(false); });
    denunciasPendientes().then(({ filas, error }) => { setDenuncias(filas); setErrorD(error); });
  }, []);

  /**
   * Aprobar o rechazar.
   *
   * NO se quita de la lista antes de tiempo, como se hacía. Con seguridad de
   * fila, un update que no alcanza ninguna fila responde bien sin escribir
   * nada: la reseña desaparecía de la pantalla y seguía pendiente para
   * siempre, sin que nadie volviera a verla.
   */
  const moderar = async (r: Resena, aprobar: boolean, motivo?: MotivoRechazo) => {
    setModerando(r.id); setErrorR(null);
    const res = await moderarResena(r.id, aprobar, motivo);
    setModerando(null);
    if (!res.ok) { setErrorR(res.error ?? "No se pudo moderar."); return; }
    setResenas((p) => p.filter((x) => x.id !== r.id));
    setRechazando(null);
  };

  /**
   * Resolver una denuncia.
   *
   * NO se quita de la lista antes de tiempo. Con las reseñas se hace así
   * —desaparece al pulsar— y ahí da igual, pero una denuncia que parece
   * resuelta y no lo está desaparece de la cola para siempre y nadie vuelve a
   * mirarla. Aquí se espera a que la base confirme.
   */
  const resolver = async (d: Denuncia, estado: "retirado" | "desestimado") => {
    setResolviendo(d.id); setErrorD(null);
    const r = await resolverDenuncia(d.id, estado, "");
    setResolviendo(null);
    if (!r.ok) { setErrorD(r.error ?? "No se pudo resolver."); return; }
    setDenuncias((p) => p.filter((x) => x.id !== d.id));
  };

  return (
    <main className="pb-10">
      <PanelHeader titulo="Moderación" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">
        <div className="mb-4 flex gap-2">
          <button onClick={() => setTab("resenas")}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-extrabold transition ${tab === "resenas" ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
            Reseñas ({resenas.length})
          </button>
          <button onClick={() => setTab("flyers")}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-extrabold transition ${tab === "flyers" ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
            Flyers ({denuncias.length})
          </button>
        </div>

        {tab === "resenas" && (
          cargando ? (
            <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
          ) : (
            <div className="flex flex-col gap-3">
              {errorR && (
                <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {errorR}
                </p>
              )}
              {resenas.map((r) => (
                <div key={r.id} className={`rounded-2xl p-4 shadow-tarjeta ring-1 ${
                  r.estado === "apelada" ? "bg-oro/10 ring-oro/40" : "bg-white ring-black/5"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-black">
                      {r.profiles?.display_name || "Tardícola"}
                      <span className="font-semibold text-tinta/50"> · reseña a un {r.objetivo_tipo}</span>
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-black text-oro-600">{r.puntuacion} <Star size={14} fill="currentColor" /></span>
                  </div>
                  {r.comentario && <p className="mt-1 text-sm font-semibold text-tinta/70">{r.comentario}</p>}

                  {/* Una apelación llega con su historia: qué se decidió, por
                      qué, y qué contesta. Sin eso hay que decidir a ciegas
                      sobre algo que ya se decidió una vez. */}
                  {r.estado === "apelada" && (
                    <div className="mt-2 rounded-xl bg-white p-3 ring-1 ring-oro/30">
                      <p className="text-xs font-black uppercase tracking-wide text-oro-700">
                        Apela el rechazo por «{etiquetaMotivo(r.motivo_rechazo)}»
                      </p>
                      <p className="mt-1 text-sm font-semibold text-tinta/75">{r.apelacion}</p>
                    </div>
                  )}

                  {rechazando === r.id ? (
                    <div className="mt-3">
                      <p className="mb-1.5 text-sm font-black text-tinta/70">¿Por qué se rechaza?</p>
                      <div className="flex flex-col gap-1.5">
                        {MOTIVOS_RECHAZO.map((m) => (
                          <button key={m.k} onClick={() => moderar(r, false, m.k)} disabled={moderando === r.id}
                            className="rounded-xl bg-black/[0.03] px-3 py-2.5 text-left text-sm font-bold transition hover:bg-black/[0.06] disabled:opacity-40">
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setRechazando(null)}
                        className="mt-2 text-xs font-black text-tinta/50">Cancelar</button>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => moderar(r, true)} disabled={moderando === r.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-magenta py-2.5 text-sm font-extrabold text-white disabled:opacity-40">
                        {moderando === r.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Aprobar
                      </button>
                      <button onClick={() => setRechazando(r.id)} disabled={moderando === r.id}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-tinta/70 ring-1 ring-black/10 disabled:opacity-40">
                        <X size={16} /> Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {resenas.length === 0 && !errorR && <p className="rounded-2xl bg-white p-4 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">Sin reseñas pendientes ✅</p>}
            </div>
          )
        )}

        {tab === "flyers" && (
          <>
            {errorD && (
              <p className="mb-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {errorD}
              </p>
            )}
            <div className="flex flex-col gap-3">
              {denuncias.map((d) => {
                const motivo = MOTIVOS.find((m) => m.k === d.motivo);
                // La prueba es la que se guardó AL DENUNCIAR, no la de ahora:
                // si el local ha cambiado el flyer, hay que ver la denunciada.
                const prueba = d.flyer_url ?? d.tardeos?.flyer_url ?? null;
                const cambiado = Boolean(d.flyer_url && d.tardeos?.flyer_url && d.flyer_url !== d.tardeos.flyer_url);
                return (
                  <div key={d.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                    <div className="flex gap-3">
                      {prueba && (
                        // eslint-disable-next-line @next/next/no-img-element -- es una prueba congelada, no una imagen del producto
                        <img src={prueba} alt="" className="h-24 w-20 shrink-0 rounded-xl object-cover ring-1 ring-black/5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="inline-flex items-center gap-1.5 font-black leading-tight">
                          <Flag size={14} className="shrink-0 text-magenta" />
                          {motivo?.label ?? d.motivo}
                        </p>
                        <p className="truncate text-sm font-semibold text-tinta/60">
                          {d.tardeos?.titulo ?? "Tardeo borrado"}
                        </p>
                        {d.mensaje && (
                          <p className="mt-1 rounded-lg bg-black/[0.03] p-2 text-sm font-semibold text-tinta/75">
                            {d.mensaje}
                          </p>
                        )}
                        {cambiado && (
                          <p className="mt-1 text-xs font-black text-oro-600">
                            El local ha cambiado el flyer desde la denuncia. Arriba está el denunciado.
                          </p>
                        )}
                        <Link href={`/tardeos/${d.tardeo_id}`} target="_blank"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-black text-magenta">
                          Ver el tardeo <ExternalLink size={11} />
                        </Link>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => resolver(d, "retirado")} disabled={resolviendo === d.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-magenta py-2.5 text-sm font-extrabold text-white disabled:opacity-40">
                        {resolviendo === d.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Tienen razón
                      </button>
                      <button onClick={() => resolver(d, "desestimado")} disabled={resolviendo === d.id}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-tinta/70 ring-1 ring-black/10 disabled:opacity-40">
                        <X size={16} /> Está bien
                      </button>
                    </div>
                  </div>
                );
              })}
              {denuncias.length === 0 && !errorD && (
                <p className="rounded-2xl bg-white p-4 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">
                  Sin flyers reportados ✅
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
