"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { Store, Disc3, Check, X, Loader2, Phone, Mail, Clock } from "lucide-react";

type Solicitud = {
  id: string;
  tipo: "local" | "dj";
  objetivo_id: string;
  solicitante: string;
  cargo: string | null;
  telefono: string | null;
  mensaje: string | null;
  estado: string;
  created_at: string;
  // Rellenados aparte
  ficha: string;
  email: string;
};

/**
 * Quién ha pedido quedarse con una ficha.
 *
 * TardeosClub publica locales y DJs antes de que ellos lleguen, y desde su
 * propia ficha pueden pedir gestionarla. Aquí se comprueba y se aprueba: no se
 * asigna solo porque cualquiera puede decir que lleva el Miracle.
 *
 * Aprobar llama a `aprobar_reclamacion` (lote 30), que enlaza la ficha y cierra
 * la solicitud en una sola operación. Hacerlo desde aquí con dos escrituras
 * dejaría, si falla la segunda, la ficha con dueño y la solicitud pendiente.
 */
export default function AdminReclamaciones() {
  const [filas, setFilas] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [obrando, setObrando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [verResueltas, setVerResueltas] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    const { data, error: e } = await supabase
      .from("solicitudes_reclamacion").select("*")
      .order("created_at", { ascending: false });
    if (e) { setError(e.message); setCargando(false); return; }
    const base = (data ?? []) as Solicitud[];

    // Nombres de las fichas y emails de quien pide, en dos consultas y no una
    // por fila.
    const locales = base.filter((s) => s.tipo === "local").map((s) => s.objetivo_id);
    const djs = base.filter((s) => s.tipo === "dj").map((s) => s.objetivo_id);
    const perfiles = [...new Set(base.map((s) => s.solicitante))];
    const [l, d, p] = await Promise.all([
      locales.length ? supabase.from("locales").select("id,nombre").in("id", locales) : { data: [] },
      djs.length ? supabase.from("djs").select("id,nombre_artistico").in("id", djs) : { data: [] },
      perfiles.length ? supabase.from("profiles").select("id,email").in("id", perfiles) : { data: [] },
    ]);
    const nombres = new Map<string, string>();
    (l.data ?? []).forEach((x: any) => nombres.set(x.id, x.nombre));
    (d.data ?? []).forEach((x: any) => nombres.set(x.id, x.nombre_artistico));
    const emails = new Map<string, string>();
    (p.data ?? []).forEach((x: any) => emails.set(x.id, x.email ?? "—"));

    setFilas(base.map((s) => ({
      ...s,
      ficha: nombres.get(s.objetivo_id) ?? "(ficha borrada)",
      email: emails.get(s.solicitante) ?? "—",
    })));
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const aprobar = async (s: Solicitud) => {
    setObrando(s.id); setError("");
    const { data, error: e } = await supabase.rpc("aprobar_reclamacion", { p_id: s.id });
    setObrando(null);
    if (e) { setError(e.message); return; }
    if (!(data as any)?.ok) { setError((data as any)?.error ?? "No se pudo aprobar."); return; }
    cargar();
  };

  const rechazar = async (s: Solicitud) => {
    setObrando(s.id); setError("");
    const { error: e } = await supabase
      .from("solicitudes_reclamacion")
      .update({ estado: "rechazada", resuelta_en: new Date().toISOString() })
      .eq("id", s.id);
    setObrando(null);
    if (e) { setError(e.message); return; }
    cargar();
  };

  const pendientes = filas.filter((s) => s.estado === "pendiente");
  const resueltas = filas.filter((s) => s.estado !== "pendiente");
  const lista = verResueltas ? resueltas : pendientes;

  return (
    <main className="pb-10">
      <PanelHeader titulo="Reclamaciones" volverHref="/admin" />
      <div className="mx-auto max-w-2xl px-4 pt-5 md:px-8">
        <div className="mb-4 flex gap-2">
          <button onClick={() => setVerResueltas(false)}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-extrabold transition ${!verResueltas ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
            Pendientes ({pendientes.length})
          </button>
          <button onClick={() => setVerResueltas(true)}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-extrabold transition ${verResueltas ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
            Resueltas ({resueltas.length})
          </button>
        </div>

        {error && <p className="mb-3 rounded-xl bg-magenta-50 p-3 text-sm font-bold text-magenta">{error}</p>}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
        ) : lista.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
            {verResueltas ? "Todavía no has resuelto ninguna." : "No hay solicitudes pendientes ✅"}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {lista.map((s) => (
              <div key={s.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
                    {s.tipo === "local" ? <Store size={20} /> : <Disc3 size={20} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={s.tipo === "local" ? `/locales/${s.objetivo_id}` : `/djs/${s.objetivo_id}`}
                      className="block truncate font-display text-lg font-black leading-tight hover:text-magenta">
                      {s.ficha}
                    </Link>
                    <p className="mt-0.5 inline-flex items-center gap-1 truncate text-sm font-semibold text-tinta/70">
                      <Mail size={13} /> {s.email}
                    </p>
                    {s.cargo && <p className="text-sm font-semibold text-tinta/60">{s.cargo}</p>}
                    {s.telefono && (
                      <a href={`tel:${s.telefono}`} className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold text-magenta">
                        <Phone size={13} /> {s.telefono}
                      </a>
                    )}
                    {s.mensaje && <p className="mt-1 text-sm font-semibold text-tinta/60">«{s.mensaje}»</p>}
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-tinta/40">
                      <Clock size={11} /> {new Date(s.created_at).toLocaleDateString("es-ES")}
                      {s.estado !== "pendiente" && ` · ${s.estado}`}
                    </p>
                  </div>
                </div>

                {s.estado === "pendiente" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => aprobar(s)} disabled={obrando === s.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-magenta py-3 text-sm font-extrabold text-white disabled:opacity-40">
                      {obrando === s.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Aprobar
                    </button>
                    <button onClick={() => rechazar(s)} disabled={obrando === s.id}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-tinta/70 ring-1 ring-black/10 disabled:opacity-40">
                      <X size={18} /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 text-center text-xs font-semibold text-tinta/50">
          Aprobar enlaza la ficha con esa cuenta. Compruébalo antes: nadie verifica por ti.
        </p>
      </div>
    </main>
  );
}
