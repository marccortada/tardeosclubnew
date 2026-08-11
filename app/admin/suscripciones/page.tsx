"use client";

import { useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { Store, Disc3 } from "lucide-react";

type Sub = { id: string; nombre: string; rol: "local" | "dj"; plan: string; estado: "activa" | "impago" };

const SUBS: Sub[] = [
  { id: "s1", nombre: "Sala Blau", rol: "local", plan: "Fundador", estado: "activa" },
  { id: "s2", nombre: "Chiringuito La Marea", rol: "local", plan: "Anual", estado: "activa" },
  { id: "s3", nombre: "Terraza Costa", rol: "local", plan: "Mensual", estado: "impago" },
  { id: "s4", nombre: "DJ Nando", rol: "dj", plan: "Anual", estado: "activa" },
  { id: "s5", nombre: "DJ Kiko", rol: "dj", plan: "Mensual", estado: "impago" },
  { id: "s6", nombre: "Beach Club Sol", rol: "local", plan: "Fundador", estado: "activa" },
];

const FILTROS = [
  { k: "todas", label: "Todas" },
  { k: "impago", label: "Impagos" },
  { k: "Fundador", label: "Fundador" },
];

export default function AdminSuscripciones() {
  const [filtro, setFiltro] = useState("todas");

  const lista = SUBS.filter((s) =>
    filtro === "todas" ? true : filtro === "impago" ? s.estado === "impago" : s.plan === filtro
  );
  const impagos = SUBS.filter((s) => s.estado === "impago").length;

  return (
    <main className="pb-10">
      <PanelHeader titulo="Suscripciones" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
            <p className="font-display text-2xl font-black">{SUBS.length}</p>
            <p className="text-xs font-bold text-tinta/60">Suscritos</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
            <p className="font-display text-2xl font-black text-magenta">{impagos}</p>
            <p className="text-xs font-bold text-tinta/60">Impagos</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
            <p className="font-display text-2xl font-black text-oro-600">1.240 €</p>
            <p className="text-xs font-bold text-tinta/60">MRR</p>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {FILTROS.map((f) => (
            <button key={f.k} onClick={() => setFiltro(f.k)}
              className={`min-h-[44px] flex-1 rounded-xl text-sm font-extrabold transition ${filtro === f.k ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {lista.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
                {s.rol === "local" ? <Store size={22} /> : <Disc3 size={22} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black leading-tight">{s.nombre}</p>
                <p className="text-sm font-semibold text-tinta/60">
                  Plan {s.plan}
                  {s.plan === "Fundador" && <span className="ml-1 rounded-full bg-oro/20 px-2 py-0.5 text-xs font-black text-oro-600">6 meses gratis</span>}
                </p>
              </div>
              {s.estado === "impago" ? (
                <button className="shrink-0 rounded-xl bg-magenta px-3 py-2 text-xs font-extrabold text-white">Recordar pago</button>
              ) : (
                <span className="shrink-0 rounded-full bg-magenta-50 px-3 py-1.5 text-xs font-black text-magenta-700">Activa</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
