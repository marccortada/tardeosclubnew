"use client";

import { useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { Bell, Send, Trash2, Sparkles, Loader2 } from "lucide-react";

type Popup = { id: string; titulo: string; mensaje: string; tipo: string; activo: boolean };

const TIPOS = ["Oferta", "Noticia", "Promo"];

export default function AdminPopups() {
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipo, setTipo] = useState("Oferta");
  const [popups, setPopups] = useState<Popup[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.from("popups").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setPopups((data as Popup[]) ?? []);
      setCargando(false);
    });
  }, []);

  const lanzar = async () => {
    if (!titulo.trim()) return;
    setEnviando(true);
    const { data } = await supabase
      .from("popups")
      .insert({ titulo: titulo.trim(), mensaje: mensaje.trim(), tipo, activo: true })
      .select()
      .single();
    setEnviando(false);
    if (data) { setPopups((p) => [data as Popup, ...p]); setTitulo(""); setMensaje(""); }
  };

  const toggle = async (u: Popup) => {
    const v = !u.activo;
    setPopups((p) => p.map((x) => (x.id === u.id ? { ...x, activo: v } : x)));
    await supabase.from("popups").update({ activo: v }).eq("id", u.id);
  };

  const borrar = async (id: string) => {
    setPopups((p) => p.filter((x) => x.id !== id));
    await supabase.from("popups").delete().eq("id", id);
  };

  return (
    <main className="pb-10">
      <PanelHeader titulo="Popups" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">
        {/* Vista previa */}
        <p className="mb-2 text-sm font-black text-tinta/60">Vista previa (lo que ve el cliente)</p>
        <div className="mb-5 overflow-hidden rounded-3xl bg-marca p-6 text-white shadow-tarjeta">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-black"><Sparkles size={12} /> {tipo}</span>
          <h3 className="mt-2 font-display text-2xl font-black leading-tight">{titulo || "Título del popup"}</h3>
          <p className="mt-1 font-semibold text-white/90">{mensaje || "Aquí va el mensaje para el cliente."}</p>
        </div>

        {/* Formulario */}
        <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
          <label className="mb-1 block text-sm font-black text-tinta/70">Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="¡Verano tardícola!"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />
          <label className="mb-1 mt-3 block text-sm font-black text-tinta/70">Mensaje</label>
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} placeholder="Este finde, tardeos gratis…"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />
          <label className="mb-1 mt-3 block text-sm font-black text-tinta/70">Tipo</label>
          <div className="flex gap-2">
            {TIPOS.map((t) => (
              <button key={t} onClick={() => setTipo(t)}
                className={`min-h-[44px] flex-1 rounded-xl text-sm font-extrabold transition ${tipo === t ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
                {t}
              </button>
            ))}
          </div>
          <button onClick={lanzar} disabled={enviando || !titulo.trim()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40">
            {enviando ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} Lanzar popup
          </button>
        </div>

        {/* Lista */}
        <p className="mb-2 mt-6 text-sm font-black text-tinta/60">Popups ({popups.length})</p>
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-8 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {popups.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <Bell size={22} className={u.activo ? "text-magenta" : "text-tinta/30"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black leading-tight">{u.titulo}</p>
                  <p className="truncate text-sm font-semibold text-tinta/60">{u.mensaje}</p>
                </div>
                <button onClick={() => toggle(u)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${u.activo ? "bg-magenta-50 text-magenta-700" : "bg-black/5 text-tinta/50"}`}>
                  {u.activo ? "Activo" : "Pausado"}
                </button>
                <button onClick={() => borrar(u.id)} aria-label="Eliminar" className="shrink-0 text-tinta/30 hover:text-magenta"><Trash2 size={18} /></button>
              </div>
            ))}
            {popups.length === 0 && <p className="rounded-2xl bg-white p-4 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">Aún no hay popups.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
