"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Interruptores: recordatorios (día antes y 1 h antes) y aviso de fin. Cambios y cancelaciones llegan siempre. */
export default function PreferenciasAvisos({ uid }: { uid: string }) {
  const [v, setV] = useState<{ recordatorios: boolean; fin_evento: boolean } | null>(null);
  const [falta, setFalta] = useState(false);
  useEffect(() => {
    supabase.from("preferencias_avisos").select("recordatorios,fin_evento").eq("profile_id", uid).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setFalta(true); return; }
        setV(data ?? { recordatorios: true, fin_evento: true });
      });
  }, [uid]);
  if (falta) return null;
  if (!v) return null;
  const poner = async (k: "recordatorios" | "fin_evento", val: boolean) => {
    const nuevo = { ...v, [k]: val };
    setV(nuevo);
    const { error } = await supabase.from("preferencias_avisos").upsert({ profile_id: uid, ...nuevo, updated_at: new Date().toISOString() });
    if (error) setV(v);
  };
  const fila = (k: "recordatorios" | "fin_evento", t: string, d: string) => (
    <label className="flex min-h-[56px] items-center justify-between gap-3 border-b border-linea py-3 last:border-0">
      <span><span className="block text-[16px] font-semibold">{t}</span><span className="block text-[15px] text-tinta-suave">{d}</span></span>
      <input type="checkbox" className="h-6 w-6 accent-magenta" checked={v[k]} onChange={(e) => poner(k, e.target.checked)} />
    </label>
  );
  return (
    <section>
      {fila("recordatorios", "Recordatorios de mis planes", "El día antes y 1 h antes, con música para ir calentando.")}
      {fila("fin_evento", "Al terminar el tardeo", "«¿Qué tal ha ido?» y consejos para volver seguro.")}
      <p className="pt-2 text-[15px] text-tinta-suave">Los cambios de hora y las cancelaciones te llegan siempre.</p>
    </section>
  );
}
