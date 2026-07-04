"use client";

import { useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { Store, BadgeCheck, Eye, EyeOff, Loader2 } from "lucide-react";

type L = { id: string; nombre: string; zona: string | null; verificado: boolean; estado: string };

export default function AdminLocales() {
  const [locales, setLocales] = useState<L[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("locales").select("id,nombre,zona,verificado,estado").order("created_at", { ascending: false })
      .then(({ data }) => { setLocales((data as L[]) ?? []); setCargando(false); });
  }, []);

  const setVerificado = async (l: L) => {
    const v = !l.verificado;
    setLocales((p) => p.map((x) => (x.id === l.id ? { ...x, verificado: v } : x)));
    await supabase.from("locales").update({ verificado: v }).eq("id", l.id);
  };
  const setOculto = async (l: L) => {
    const nuevo = l.estado === "oculto_impago" ? "activo" : "oculto_impago";
    setLocales((p) => p.map((x) => (x.id === l.id ? { ...x, estado: nuevo } : x)));
    await supabase.from("locales").update({ estado: nuevo }).eq("id", l.id);
  };

  return (
    <main className="pb-10">
      <PanelHeader titulo="Locales" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
        ) : (
          <>
            <p className="mb-4 text-sm font-bold text-tinta/60">{locales.length} locales</p>
            <div className="flex flex-col gap-3">
              {locales.map((l) => {
                const oculto = l.estado === "oculto_impago";
                return (
                  <div key={l.id} className={`flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5 ${oculto ? "opacity-60" : ""}`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><Store size={22} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="inline-flex items-center gap-1 truncate font-black leading-tight">
                        {l.nombre}
                        {l.verificado && <BadgeCheck size={16} className="text-oro-600" />}
                      </p>
                      <p className="text-sm font-semibold text-tinta/60">{l.zona || "—"} · {l.estado}</p>
                    </div>
                    <button onClick={() => setVerificado(l)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${l.verificado ? "bg-oro/20 text-oro-600" : "bg-black/5 text-tinta/50"}`}>
                      {l.verificado ? "Verificado" : "Verificar"}
                    </button>
                    <button onClick={() => setOculto(l)} aria-label={oculto ? "Mostrar" : "Ocultar"} className="shrink-0 text-tinta/40 hover:text-magenta">
                      {oculto ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                );
              })}
              {locales.length === 0 && <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">Aún no hay locales.</p>}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
