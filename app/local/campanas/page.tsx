"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import SegmentadorPopup, { SIN_SEGMENTAR, type Segmentacion } from "@/components/SegmentadorPopup";
import { useAuth } from "@/lib/useAuth";
import { getMiLocal } from "@/lib/tardeos";
import { pedirCampana, getCampanasDeLocal, alcanceEstimado, type Campana } from "@/lib/campanas";
import { Loader2, Send, Users, Clock, Check, X, Megaphone } from "lucide-react";

const TIPOS = ["Oferta", "Aviso", "Evento"];

/**
 * Pedir una campaña de pop-up.
 *
 * El local pide y el admin aprueba. No se publica solo a propósito: un pop-up
 * es lo único de la app que interrumpe a todo el mundo, y quien lo paga no es
 * quien debe decidir si molesta.
 */
export default function MisCampanas() {
  const { user, loading } = useAuth();
  const [local, setLocal] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [mias, setMias] = useState<Campana[]>([]);

  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipo, setTipo] = useState("Oferta");
  const [seg, setSeg] = useState<Segmentacion>(SIN_SEGMENTAR);
  const [alcance, setAlcance] = useState<number | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setCargando(false); return; }
    (async () => {
      const l = await getMiLocal(user.id);
      setLocal(l);
      if (l) setMias(await getCampanasDeLocal(l.id));
      setCargando(false);
    })();
  }, [user, loading]);

  /**
   * El alcance se recalcula al cambiar el segmento, con un respiro de medio
   * segundo: sin él, marcar cinco estilos seguidos lanza cinco consultas y la
   * cifra va dando saltos mientras se elige.
   */
  useEffect(() => {
    if (!user) return;
    setCalculando(true);
    const t = setTimeout(async () => {
      setAlcance(await alcanceEstimado(seg));
      setCalculando(false);
    }, 500);
    return () => clearTimeout(t);
  }, [seg, user]);

  const enviar = async () => {
    if (!local) return;
    if (!titulo.trim()) { setError("Ponle un título."); return; }
    setEnviando(true); setError("");
    const { error: e } = await pedirCampana(local.id, { titulo, mensaje, tipo }, seg);
    setEnviando(false);
    if (e) { setError("No se pudo enviar: " + e.message); return; }
    setTitulo(""); setMensaje(""); setSeg(SIN_SEGMENTAR); setEnviada(true);
    setMias(await getCampanasDeLocal(local.id));
  };

  if (loading || cargando) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</main>;
  }

  if (!user || !local) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-bold text-tinta/70">Esto es para locales y promotores.</p>
        <Link href="/perfil" className="mt-4 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Ir a mi cuenta</Link>
      </main>
    );
  }

  return (
    <main className="pb-28 md:pb-12">
      <PanelHeader titulo="Campañas" volverHref="/local" />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        <p className="mb-4 font-semibold text-tinta/60">
          Un aviso que le sale a los tardícolas al abrir la app. Eliges a quién y lo revisamos antes de lanzarlo.
        </p>

        <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
          <label className="mb-1 block text-sm font-black text-tinta/70">Título</label>
          <input value={titulo} onChange={(e) => { setTitulo(e.target.value); setEnviada(false); }}
            placeholder="2x1 en cócteles este sábado"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

          <label className="mb-1 mt-3 block text-sm font-black text-tinta/70">Mensaje</label>
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2}
            placeholder="De 18 a 21 h, presentando el aviso."
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

          <SegmentadorPopup valor={seg} onCambio={(s) => { setSeg(s); setEnviada(false); }} />

          {/* La cifra es lo que convierte esto en un producto: nadie paga por
              "a ver a cuántos llega". */}
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-tinta px-4 py-3 text-white">
            <Users size={18} className="text-oro" />
            <span className="flex-1 text-sm font-extrabold">
              {calculando ? "Calculando alcance…"
                : alcance === null ? "No se pudo calcular el alcance"
                : alcance === 0 ? "Menos de 5 personas encajan"
                : `Unas ${alcance} personas encajan`}
            </span>
          </div>
          {alcance === 0 && !calculando && (
            /* "Menos de 5" no es "ninguno": la base no da la cifra exacta
               cuando es tan pequeña, para que no se pueda usar como buscador
               de personas. Conviene decirlo o parece un error. */
            <p className="mt-1.5 text-xs font-semibold text-tinta/55">
              No damos el número exacto cuando el público es muy pequeño. Prueba a quitar algún criterio:
              cada uno que añades reduce a quién le llega.
            </p>
          )}

          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          {enviada && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-oro/15 p-3 text-sm font-bold text-oro-600">
              <Check size={16} /> Pedida. La revisamos y te avisamos.
            </p>
          )}

          <button onClick={enviar} disabled={enviando || !titulo.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40">
            {enviando ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} Pedir campaña
          </button>
        </div>

        <p className="mb-2 mt-6 text-sm font-black text-tinta/60">Tus campañas ({mias.length})</p>
        {mias.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
            Todavía no has pedido ninguna.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mias.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <div className="flex items-start gap-2">
                  <Megaphone size={16} className="mt-0.5 shrink-0 text-magenta" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black leading-tight">{c.titulo}</p>
                    {c.mensaje && <p className="text-sm font-semibold text-tinta/60">{c.mensaje}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                    c.estado === "aprobada" ? "bg-oro/20 text-oro-600"
                      : c.estado === "rechazada" ? "bg-red-50 text-red-700"
                      : "bg-black/5 text-tinta/60"
                  }`}>
                    {c.estado === "aprobada" ? <><Check size={11} className="inline" /> En marcha</>
                      : c.estado === "rechazada" ? <><X size={11} className="inline" /> Rechazada</>
                      : <><Clock size={11} className="inline" /> Pendiente</>}
                  </span>
                </div>
                {/* El motivo del rechazo, para que sepa qué corregir. */}
                {c.estado === "rechazada" && c.nota_admin && (
                  <p className="mt-2 rounded-xl bg-red-50 p-2.5 text-sm font-semibold text-red-800">{c.nota_admin}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
