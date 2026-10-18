"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarClock, CheckCheck, Gift, LogIn, Music, PartyPopper, Ban, Star, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver, enlacePropio } from "@/lib/volver";
import { claseBoton } from "@/components/Boton";
import Paginacion, { usePaginado, EstadoLista, Filtros } from "@/components/panel/Paginacion";
import { CabeceraApp, Mensaje } from "@/components/retorno/Piezas";

type Aviso = { id: string; tipo: string; titulo: string; cuerpo: string | null; url: string | null; leido_en: string | null; created_at: string };

const ICONO: Record<string, typeof Bell> = {
  recordatorio: Music, fin_evento: Star, cambio: CalendarClock, cancelacion: Ban, sorteo: Gift, espera: PartyPopper,
};

function hace(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * Bandeja de la campana (dossier 2.0). La campana con contador la pone el
 * equipo A en la cabecera y enlaza aquí. Los no leídos van destacados; tocar
 * uno lo marca como leído y lleva a su destino.
 */
export default function Avisos() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  // «No leídos» en el servidor: con muchos avisos, los pendientes pueden estar
  // en la página 3 y aquí se ven todos juntos.
  const [soloNoLeidos, setSoloNoLeidos] = useState(false);

  const p = usePaginado<Aviso>(
    (desde, hasta) => {
      if (!user) return Promise.resolve({ data: [], count: 0, error: null });
      let q = supabase.from("avisos").select("id,tipo,titulo,cuerpo,url,leido_en,created_at", { count: "exact" })
        .eq("profile_id", user.id);
      if (soloNoLeidos) q = q.is("leido_en", null);
      return q.order("created_at", { ascending: false }).order("id").range(desde, hasta);
    },
    [user?.id, soloNoLeidos], 20,
  );
  const hayNoLeidos = p.filas.some((a) => !a.leido_en);

  const marcarTodos = async () => {
    if (!user) return;
    const ahora = new Date().toISOString();
    const { error } = await supabase.from("avisos").update({ leido_en: ahora }).eq("profile_id", user.id).is("leido_en", null);
    if (error) { setAviso("No se pudieron marcar. Inténtalo otra vez."); return; }
    // En «No leídos» ya no queda ninguno: se vuelve a pedir la lista (vacía).
    if (soloNoLeidos) p.recargar(); else p.cambiar(() => true, { leido_en: ahora });
    window.dispatchEvent(new Event("avisos-leidos")); // la campana (equipo A) puede escucharlo para recontar
  };

  const abrir = async (a: Aviso) => {
    if (!a.leido_en) {
      const ahora = new Date().toISOString();
      p.cambiar((x) => x.id === a.id, { leido_en: ahora });
      await supabase.from("avisos").update({ leido_en: ahora }).eq("id", a.id);
      window.dispatchEvent(new Event("avisos-leidos"));
    }
    const destino = enlacePropio(a.url);
    if (destino) router.push(destino);
  };

  if (loading) return <div className="min-h-screen bg-white"><CabeceraApp titulo="Avisos" /></div>;
  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <CabeceraApp titulo="Avisos" />
        <main className="mx-auto max-w-lg px-4 pt-6">
          <Mensaje icono={<LogIn size={26} aria-hidden />} titulo="Entra para ver tus avisos">
            <p>Recordatorios de tus planes, cambios de hora y sorteos.</p>
            <Link href={entrarYVolver("/avisos")} className={claseBoton("primario", "normal", false, "mt-4")}>Entrar</Link>
          </Mensaje>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      <CabeceraApp titulo="Avisos" />
      <main className="mx-auto max-w-lg px-4 pt-4">
        <div className="mb-3">
          <Filtros valor={soloNoLeidos ? "no_leidos" : "todos"} onCambiar={(k) => setSoloNoLeidos(k === "no_leidos")}
            opciones={[{ clave: "todos" as const, label: "Todos" }, { clave: "no_leidos" as const, label: "No leídos" }]} />
        </div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[15px] text-tinta-suave">{p.total ? `${p.total} ${soloNoLeidos ? "sin leer" : "avisos"}` : ""}</p>
          {hayNoLeidos && (
            <button onClick={marcarTodos} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[15px] font-semibold text-magenta hover:bg-magenta-50">
              <CheckCheck size={18} aria-hidden /> Marcar todos como leídos
            </button>
          )}
        </div>
        {aviso && <p role="alert" className="mb-3 rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{aviso}</p>}
        <EstadoLista cargando={p.cargando} error={p.error ? (/avisos/.test(p.error) ? "falta el lote 63" : p.error) : null}
          filas={p.filas.length} vacio={soloNoLeidos ? "No tienes avisos sin leer. Todo al día." : "No tienes avisos. Aquí te llegarán los recordatorios de tus planes."} />
        <ul className="flex flex-col gap-2">
          {p.filas.map((a) => {
            const Ic = ICONO[a.tipo] ?? Bell;
            const nuevo = !a.leido_en;
            return (
              <li key={a.id}>
                <button onClick={() => abrir(a)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    nuevo ? "border-magenta/30 bg-magenta-50/60" : "border-linea bg-white hover:bg-marfil"}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${nuevo ? "bg-magenta text-white" : "bg-marfil-100 text-tinta-suave"}`}>
                    <Ic size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={`text-[16px] leading-snug ${nuevo ? "font-bold" : "font-semibold"}`}>{a.titulo}</span>
                      <span className="shrink-0 text-[13px] text-tinta-suave">{hace(a.created_at)}</span>
                    </span>
                    {a.cuerpo && <span className="mt-1 block text-[15px] leading-snug text-tinta-suave">{a.cuerpo}</span>}
                    {nuevo && <span className="sr-only">No leído</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
        {/* Qué avisos quieres se elige en Perfil → Notificaciones: aquí solo
            la bandeja (antes estaban en los dos sitios). */}
        <Link href="/perfil/notificaciones" className="mt-6 flex min-h-[48px] items-center justify-center gap-2 text-[15px] font-semibold text-magenta-700">
          <Settings size={17} aria-hidden /> Elegir qué avisos quiero
        </Link>
      </main>
    </div>
  );
}
