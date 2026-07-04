"use client";

import { useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { getResenasPendientes, moderarResena, Resena } from "@/lib/resenas";
import { Check, X, Star, Loader2 } from "lucide-react";

export default function AdminModeracion() {
  const [tab, setTab] = useState<"resenas" | "flyers">("resenas");
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getResenasPendientes().then((r) => { setResenas(r); setCargando(false); });
  }, []);

  const moderar = async (id: string, aprobar: boolean) => {
    setResenas((p) => p.filter((x) => x.id !== id));
    await moderarResena(id, aprobar);
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
            Flyers
          </button>
        </div>

        {tab === "resenas" && (
          cargando ? (
            <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
          ) : (
            <div className="flex flex-col gap-3">
              {resenas.map((r) => (
                <div key={r.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                  <div className="flex items-center justify-between">
                    <p className="font-black">
                      {r.profiles?.display_name || "Tardícola"}
                      <span className="font-semibold text-tinta/50"> · reseña a un {r.objetivo_tipo}</span>
                    </p>
                    <span className="inline-flex items-center gap-0.5 text-sm font-black text-oro-600">{r.puntuacion} <Star size={14} fill="currentColor" /></span>
                  </div>
                  {r.comentario && <p className="mt-1 text-sm font-semibold text-tinta/70">{r.comentario}</p>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => moderar(r.id, true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-magenta py-2.5 text-sm font-extrabold text-white"><Check size={16} /> Aprobar</button>
                    <button onClick={() => moderar(r.id, false)} className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-tinta/70 ring-1 ring-black/10"><X size={16} /> Rechazar</button>
                  </div>
                </div>
              ))}
              {resenas.length === 0 && <p className="rounded-2xl bg-white p-4 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">Sin reseñas pendientes ✅</p>}
            </div>
          )
        )}

        {tab === "flyers" && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">
            No hay flyers reportados. (El reporte de flyers se activará más adelante.)
          </p>
        )}
      </div>
    </main>
  );
}
