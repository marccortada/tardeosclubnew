"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import AsignarDueno from "@/components/AsignarDueno";
import { supabase } from "@/lib/supabase";
import { BadgeCheck, Star, Eye, EyeOff, Loader2, Plus } from "lucide-react";
import { tieneValoracion, valoracion } from "@/lib/reputacion";

type D = {
  id: string; nombre_artistico: string; estilos: string[] | null; verificado: boolean;
  reputacion_score: number | null; oculto: boolean;
  profile_id: string | null; duenoEmail: string | null;
};

export default function AdminDjs() {
  const [djs, setDjs] = useState<D[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("djs").select("id,nombre_artistico,estilos,verificado,reputacion_score,oculto,profile_id")
        .order("created_at", { ascending: false });
      const filas = data ?? [];

      const ids = [...new Set(filas.map((d) => d.profile_id).filter(Boolean))] as string[];
      const emails = new Map<string, string>();
      if (ids.length) {
        const { data: perfiles } = await supabase.from("profiles").select("id,email").in("id", ids);
        (perfiles ?? []).forEach((p) => emails.set(p.id, p.email ?? "—"));
      }

      setDjs(filas.map((d) => ({
        ...d, duenoEmail: d.profile_id ? emails.get(d.profile_id) ?? "—" : null,
      })) as D[]);
      setCargando(false);
    })();
  }, []);

  const toggle = async (d: D, campo: "verificado" | "oculto") => {
    const v = !d[campo];
    setDjs((p) => p.map((x) => (x.id === d.id ? { ...x, [campo]: v } : x)));
    await supabase.from("djs").update({ [campo]: v }).eq("id", d.id);
  };

  return (
    <main className="pb-10">
      <PanelHeader titulo="DJs" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-tinta/60">{djs.length} DJs</p>
              <Link href="/admin/crear" className="inline-flex items-center gap-1.5 rounded-full bg-magenta px-4 py-2 text-sm font-black text-white active:scale-[0.98]">
                <Plus size={16} /> Crear DJ
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {djs.map((d) => (
                <div key={d.id} className={`flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5 ${d.oculto ? "opacity-60" : ""}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marca font-black text-white">
                    {String(d.nombre_artistico || "DJ").replace("DJ ", "").charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="inline-flex items-center gap-1 truncate font-black leading-tight">
                      {d.nombre_artistico}
                      {d.verificado && <BadgeCheck size={16} className="text-oro-600" />}
                    </p>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-tinta/60">
                      {(d.estilos ?? []).join(" · ") || "—"}
                      <span className="inline-flex items-center gap-0.5 text-oro-600"><Star size={12} fill="currentColor" /> {tieneValoracion(d.reputacion_score) ? valoracion(d.reputacion_score) : "—"}</span>
                    </p>
                    <AsignarDueno
                      tabla="djs" campo="profile_id" id={d.id} duenoEmail={d.duenoEmail}
                      onAsignado={(email) => setDjs((p) => p.map((x) => x.id === d.id ? { ...x, duenoEmail: email } : x))}
                    />
                  </div>
                  <button onClick={() => toggle(d, "verificado")} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${d.verificado ? "bg-oro/20 text-oro-600" : "bg-black/5 text-tinta/50"}`}>
                    {d.verificado ? "Verificado" : "Verificar"}
                  </button>
                  <button onClick={() => toggle(d, "oculto")} aria-label={d.oculto ? "Mostrar" : "Ocultar"} className="shrink-0 text-tinta/40 hover:text-magenta">
                    {d.oculto ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              ))}
              {djs.length === 0 && <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">Aún no hay DJs.</p>}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
