"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { X, Sparkles, ArrowRight } from "lucide-react";

type Popup = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  /** null = una sola vez · 0 = cada visita · N = cada N horas */
  repetir_horas: number | null;
  publico: "todos" | "anonimos" | "registrados" | "locales" | "djs";
  desde: string | null;
  hasta: string | null;
};

const CLAVE = (id: string) => `popup-visto-${id}`;

/**
 * ¿Toca enseñar este popup a este visitante?
 *
 * Guardamos la fecha del último visto, no un simple "ya lo vio": con un
 * booleano no había forma de repetirlo cada día o cada semana.
 * (Las marcas antiguas eran un "1", que se trata como "visto hace mucho".)
 */
function tocaEnsenar(p: Popup): boolean {
  // `?? null` y no `=== null` a secas: si el lote 17 todavía no está aplicado la
  // columna llega como undefined, y sin esto el popup saldría en CADA visita en
  // vez de una sola vez.
  const horas = p.repetir_horas ?? null;
  if (horas === null) return !localStorage.getItem(CLAVE(p.id));
  if (horas === 0) return true;

  const marca = localStorage.getItem(CLAVE(p.id));
  if (!marca) return true;
  const visto = Number(marca);
  if (!Number.isFinite(visto) || visto <= 1) return true; // marca vieja o corrupta
  return Date.now() - visto >= horas * 3600_000;
}

function dentroDeFechas(p: Popup): boolean {
  const ahora = Date.now();
  if (p.desde && ahora < new Date(p.desde).getTime()) return false;
  if (p.hasta && ahora > new Date(p.hasta).getTime()) return false;
  return true;
}

export default function PopupCliente() {
  const { user, loading } = useAuth();
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    if (loading) return;
    let cancel = false;

    (async () => {
      try {
        const { data } = await supabase
          .from("popups").select("*").eq("activo", true)
          .order("created_at", { ascending: false });
        if (cancel || !data?.length) return;

        // Primero lo barato: fechas y frecuencia se resuelven sin consultar nada.
        const candidatos = (data as Popup[]).filter(
          (p) => dentroDeFechas(p) && tocaEnsenar(p)
        );
        if (!candidatos.length) return;

        // Saber si es local o DJ cuesta dos consultas, así que solo se
        // averigua cuando algún candidato lo necesita de verdad.
        const necesitaRol = candidatos.some((p) => p.publico === "locales" || p.publico === "djs");
        let esLocal = false, esDj = false;
        if (necesitaRol && user) {
          const [l, d] = await Promise.all([
            supabase.from("locales").select("id").eq("owner_id", user.id).limit(1).maybeSingle(),
            supabase.from("djs").select("id").eq("profile_id", user.id).limit(1).maybeSingle(),
          ]);
          esLocal = !!l.data; esDj = !!d.data;
        }
        if (cancel) return;

        const elegido = candidatos.find((p) => {
          switch (p.publico) {
            case "anonimos": return !user;
            case "registrados": return !!user;
            case "locales": return esLocal;
            case "djs": return esDj;
            default: return true;
          }
        });
        if (elegido) setPopup(elegido);
      } catch {
        /* tabla aún no creada u otro error: no mostramos nada */
      }
    })();

    return () => { cancel = true; };
  }, [user, loading]);

  if (!popup) return null;

  const cerrar = () => {
    // La hora, no un "1": es lo que permite volver a enseñarlo pasado el plazo.
    localStorage.setItem(CLAVE(popup.id), String(Date.now()));
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
