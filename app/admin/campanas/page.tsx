"use client";

import { useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { getCampanas, aprobarCampana, rechazarCampana, type Campana } from "@/lib/campanas";
import { etiquetaDe } from "@/lib/musica";
import { Loader2, Check, X, Clock, Megaphone, Users } from "lucide-react";

const FILTROS = [
  { k: "pendiente", label: "Pendientes" },
  { k: "aprobada", label: "En marcha" },
  { k: "rechazada", label: "Rechazadas" },
  { k: "", label: "Todas" },
];

/** El segmento en una frase, para decidir de un vistazo. */
function resumen(c: Campana): string {
  const partes = [
    c.seg_musica?.length ? c.seg_musica.map(etiquetaDe).join(", ") : null,
    c.seg_tipos_evento?.length ? c.seg_tipos_evento.join(", ") : null,
    c.seg_edades?.length ? c.seg_edades.join(" o ") : null,
    c.seg_zonas?.length ? c.seg_zonas.join(", ") : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sin acotar: a todos los registrados";
}

export default function AdminCampanas() {
  const [filtro, setFiltro] = useState("pendiente");
  const [lista, setLista] = useState<Campana[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Qué campaña se está rechazando y con qué motivo.
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const recargar = async (f = filtro) => {
    setCargando(true);
    setLista(await getCampanas(f || undefined));
    setCargando(false);
  };

  useEffect(() => { recargar(filtro); }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const aprobar = async (c: Campana) => {
    setOcupado(c.id); setError("");
    const { error: e } = await aprobarCampana(c);
    setOcupado(null);
    if (e) { setError("No se pudo aprobar: " + e.message); return; }
    recargar();
  };

  const rechazar = async (id: string) => {
    setOcupado(id); setError("");
    const { error: e } = await rechazarCampana(id, nota);
    setOcupado(null);
    if (e) { setError("No se pudo rechazar: " + e.message); return; }
    setRechazando(null); setNota("");
    recargar();
  };

  return (
    <main className="pb-28 md:pb-12">
      <PanelHeader titulo="Campañas" volverHref="/admin" />
      <div className="mx-auto max-w-2xl px-4 pt-5 md:px-8">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTROS.map((f) => (
            <button key={f.k} onClick={() => setFiltro(f.k)}
              className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-extrabold transition ${filtro === f.k ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

        {cargando ? (
          <p className="flex items-center justify-center gap-2 py-10 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
            {filtro === "pendiente" ? "Nada pendiente de revisar." : "No hay campañas aquí."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {lista.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <div className="flex items-start gap-2">
                  <Megaphone size={17} className="mt-0.5 shrink-0 text-magenta" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black leading-tight">{c.titulo}</p>
                    <p className="text-sm font-bold text-tinta/55">
                      {c.locales?.nombre ?? "(local borrado)"}
                      {c.locales?.tipo === "promotor" && " · promotor"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                    c.estado === "aprobada" ? "bg-oro/20 text-oro-600"
                      : c.estado === "rechazada" ? "bg-red-50 text-red-700"
                      : "bg-black/5 text-tinta/60"
                  }`}>
                    {c.estado === "aprobada" ? "En marcha" : c.estado === "rechazada" ? "Rechazada" : <><Clock size={11} className="inline" /> Pendiente</>}
                  </span>
                </div>

                {c.mensaje && <p className="mt-2 text-sm font-semibold text-tinta/70">{c.mensaje}</p>}

                <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-tinta/55">
                  <Users size={13} className="mt-px shrink-0 text-magenta" /> {resumen(c)}
                </p>

                {c.estado === "pendiente" && (
                  rechazando === c.id ? (
                    <div className="mt-3">
                      {/* Con motivo obligatorio: un "rechazada" a secas deja al
                          local sin saber qué corregir, y vuelve a pedir lo mismo. */}
                      <input value={nota} onChange={(e) => setNota(e.target.value)}
                        placeholder="Por qué se rechaza (lo verá el local)"
                        className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 text-sm font-semibold outline-none focus:border-magenta" />
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => rechazar(c.id)} disabled={ocupado === c.id || !nota.trim()}
                          className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-extrabold text-white disabled:opacity-40">
                          Confirmar rechazo
                        </button>
                        <button onClick={() => { setRechazando(null); setNota(""); }}
                          className="rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-tinta/60 ring-1 ring-magenta-100">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => aprobar(c)} disabled={ocupado === c.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-magenta py-3 text-sm font-extrabold text-white disabled:opacity-40">
                        {ocupado === c.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Aprobar y lanzar
                      </button>
                      <button onClick={() => setRechazando(c.id)}
                        className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-tinta/60 ring-1 ring-magenta-100">
                        <X size={15} /> Rechazar
                      </button>
                    </div>
                  )
                )}

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
