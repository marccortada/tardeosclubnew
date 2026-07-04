"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { X, Sparkles, ArrowRight } from "lucide-react";

type Popup = { id: string; titulo: string; mensaje: string; tipo: string };

export default function PopupCliente() {
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("popups").select("*").eq("activo", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!data) return;
        if (localStorage.getItem("popup-visto-" + data.id)) return;
        setPopup(data as Popup);
      } catch {
        /* tabla aún no creada u otro error: no mostramos nada */
      }
    })();
  }, []);

  if (!popup) return null;

  const cerrar = () => {
    localStorage.setItem("popup-visto-" + popup.id, "1");
    setPopup(null);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm md:items-center" onClick={cerrar}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-marca p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="bokeh" style={{ width: 120, height: 120, top: -30, right: 20, background: "#ffd36b", opacity: 0.4 }} />
        <button onClick={cerrar} aria-label="Cerrar" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white">
          <X size={20} />
        </button>
        <div className="relative">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-black"><Sparkles size={12} /> {popup.tipo}</span>
          <h3 className="mt-2 font-display text-2xl font-black leading-tight">{popup.titulo}</h3>
          {popup.mensaje && <p className="mt-1 font-semibold text-white/90">{popup.mensaje}</p>}
          <Link href="/tardeos" onClick={cerrar} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-extrabold text-magenta">
            Ver tardeos <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
