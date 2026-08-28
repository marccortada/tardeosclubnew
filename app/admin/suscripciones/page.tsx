"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { plegar, contieneTexto } from "@/lib/texto";
import { PLANES, ETIQUETA, PRECIO, type Plan } from "@/lib/planes";
import { Store, Disc3, Loader2, Euro, AlertTriangle, Check } from "lucide-react";

type Ficha = {
  id: string;
  nombre: string;
  rol: "local" | "dj";
  plan: Plan;
  plan_estado: string;
  plan_hasta: string | null;
  pago_proveedor: string | null;
  pago_referencia: string | null;
  plan_notas: string | null;
  reclamado: boolean;
};

const ESTADOS = [
  { k: "sin_suscripcion", label: "Sin suscripción" },
  { k: "activa", label: "Al corriente" },
  { k: "impago", label: "Impago" },
  { k: "cancelada", label: "Cancelada" },
];

/**
 * Quién paga qué.
 *
 * Se marca A MANO, y es deliberado mientras sean pocos: con veinte locales la
 * comisión de la pasarela es calderilla y lo caro es el tiempo de montar altas
 * y bajas automáticas. Los campos `pago_proveedor` y `pago_referencia` están
 * para anotar dónde está el cobro de verdad (PayPal, una transferencia, lo que
 * sea) y para que el día que se automatice haya dónde enganchar.
 *
 * Esta pantalla ERA UNA MAQUETA: seis filas escritas en el código con nombres
 * inventados —"Sala Blau", "DJ Nando"— que parecían una cartera de clientes.
 */
export default function AdminSuscripciones() {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "pagando" | "impago" | "sin">("todas");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    const cols = "id,plan,plan_estado,plan_hasta,pago_proveedor,pago_referencia,plan_notas";
    const [l, d] = await Promise.all([
      supabase.from("locales").select(`${cols},nombre,owner_id`).order("nombre"),
      supabase.from("djs").select(`${cols},nombre_artistico,profile_id`).order("nombre_artistico"),
    ]);
    if (l.error || d.error) {
      const e = l.error ?? d.error;
      // 42703/PGRST204 = el lote 33 aún no está pegado.
      setError(e?.code === "42703" || e?.code === "PGRST204"
        ? "Falta pegar el lote 33 (supabase/33_planes.sql)."
        : (e?.message ?? "No se pudo cargar."));
      setCargando(false); return;
    }
    const map = (x: any, rol: "local" | "dj"): Ficha => ({
      id: x.id,
      nombre: x.nombre ?? x.nombre_artistico ?? "",
      rol,
      plan: x.plan ?? "basic",
      plan_estado: x.plan_estado ?? "sin_suscripcion",
      plan_hasta: x.plan_hasta ?? null,
      pago_proveedor: x.pago_proveedor ?? null,
      pago_referencia: x.pago_referencia ?? null,
      plan_notas: x.plan_notas ?? null,
      reclamado: Boolean(x.owner_id ?? x.profile_id),
    });
    setFichas([
      ...(l.data ?? []).map((x) => map(x, "local")),
      ...(d.data ?? []).map((x) => map(x, "dj")),
    ]);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (f: Ficha, campos: Record<string, unknown>) => {
    setGuardando(f.id); setError("");
    const tabla = f.rol === "local" ? "locales" : "djs";
    const { data, error: e } = await supabase.from(tabla).update(campos).eq("id", f.id).select("id,plan,plan_estado");
    setGuardando(null);
    if (e) { setError(e.message); return; }
    // El trigger `proteger_plan` revierte sin dar error si no eres admin: hay
    // que mirar lo que devuelve, no si falló.
    const g = data?.[0] as any;
    if (!g) { setError("No se pudo guardar. ¿Tu cuenta es admin?"); return; }
    if (campos.plan && g.plan !== campos.plan) {
      setError("La base rechazó el cambio de plan. ¿Tu cuenta es admin?"); return;
    }
    setFichas((p) => p.map((x) => (x.id === f.id ? { ...x, ...campos } as Ficha : x)));
  };

  const pagando = fichas.filter((f) => f.plan_estado === "activa");
  const impagos = fichas.filter((f) => f.plan_estado === "impago");
  const mrr = pagando.reduce((s, f) => s + PRECIO[f.plan], 0);

  const lista = fichas
    .filter((f) =>
      filtro === "todas" ? true
      : filtro === "pagando" ? f.plan_estado === "activa"
      : filtro === "impago" ? f.plan_estado === "impago"
      : f.plan_estado === "sin_suscripcion")
    .filter((f) => contieneTexto(f.nombre, plegar(busca.trim())));

  return (
    <main className="pb-10">
      <PanelHeader titulo="Suscripciones" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">

        <section className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
            <Euro size={20} className="text-magenta" />
            <p className="mt-1 font-display text-2xl font-black leading-none">{mrr} €</p>
            <p className="mt-1 text-xs font-bold text-tinta/60">al mes</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
            <Check size={20} className="text-magenta" />
            <p className="mt-1 font-display text-2xl font-black leading-none">{pagando.length}</p>
            <p className="mt-1 text-xs font-bold text-tinta/60">al corriente</p>
          </div>
          <div className={`rounded-2xl p-4 shadow-tarjeta ring-1 ${impagos.length ? "bg-oro/15 ring-oro/40" : "bg-white ring-black/5"}`}>
            <AlertTriangle size={20} className={impagos.length ? "text-oro-600" : "text-tinta/30"} />
            <p className="mt-1 font-display text-2xl font-black leading-none">{impagos.length}</p>
            <p className="mt-1 text-xs font-bold text-tinta/60">impagos</p>
          </div>
        </section>

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {([["todas","Todas"],["pagando","Al corriente"],["impago","Impagos"],["sin","Sin suscripción"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-extrabold transition ${filtro === k ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
              {l}
            </button>
          ))}
        </div>

        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca por nombre…"
          className="mb-3 w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 font-semibold outline-none focus:border-magenta" />

        {error && <p className="mb-3 rounded-xl bg-magenta-50 p-3 text-sm font-bold text-magenta">{error}</p>}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
        ) : lista.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">Nada aquí.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lista.map((f) => (
              <div key={f.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
                    {f.rol === "local" ? <Store size={18} /> : <Disc3 size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={f.rol === "local" ? `/locales/${f.id}` : `/djs/${f.id}`}
                      className="block truncate font-black leading-tight hover:text-magenta">{f.nombre}</Link>
                    <p className="text-xs font-semibold text-tinta/50">
                      {f.reclamado ? "Perfil reclamado" : "Sin reclamar · ficha nuestra"}
                      {f.pago_referencia && ` · ${f.pago_proveedor ?? "pago"}: ${f.pago_referencia}`}
                    </p>
                  </div>
                  {guardando === f.id && <Loader2 size={16} className="animate-spin text-magenta" />}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select value={f.plan} onChange={(e) => guardar(f, { plan: e.target.value })}
                    className="min-h-[44px] rounded-xl border-2 border-magenta-100 bg-white px-3 text-sm font-extrabold outline-none focus:border-magenta">
                    {PLANES.map((p) => <option key={p} value={p}>{ETIQUETA[p]} · {PRECIO[p]} €</option>)}
                  </select>
                  <select value={f.plan_estado} onChange={(e) => guardar(f, { plan_estado: e.target.value })}
                    className={`min-h-[44px] rounded-xl border-2 px-3 text-sm font-extrabold outline-none ${
                      f.plan_estado === "impago" ? "border-oro/60 bg-oro/10" : "border-magenta-100 bg-white"}`}>
                    {ESTADOS.map((e) => <option key={e.k} value={e.k}>{e.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 text-center text-xs font-semibold text-tinta/50">
          Se marca a mano a propósito. Con este volumen, montar altas y bajas automáticas
          cuesta más de lo que ahorra.
        </p>
      </div>
    </main>
  );
}
