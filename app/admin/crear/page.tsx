"use client";

import { useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { Store, CalendarPlus, Mail, ArrowRight, Check, ArrowLeft } from "lucide-react";

type Modo = "elegir" | "local" | "invitar";

export default function AdminCrear() {
  const [modo, setModo] = useState<Modo>("elegir");
  const [hecho, setHecho] = useState(false);

  if (hecho) {
    return (
      <main className="pb-10">
        <PanelHeader titulo="Crear / invitar" volverHref="/admin" />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-oro text-tinta"><Check size={44} /></span>
          <h2 className="font-display text-3xl font-black">¡Hecho!</h2>
          <p className="font-semibold text-tinta/70">La acción se ha completado (demo).</p>
          <button onClick={() => { setHecho(false); setModo("elegir"); }} className="rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
            Volver
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <PanelHeader titulo="Crear / invitar" volverHref="/admin" />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        {modo === "elegir" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setModo("local")} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-marca text-white"><Store size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear local</span><span className="text-sm font-semibold text-tinta/60">Alta manual de un local</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <Link href="/local/crear" className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-oro text-tinta"><CalendarPlus size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear tardeo</span><span className="text-sm font-semibold text-tinta/60">Con el flujo asistido por IA</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </Link>

            <button onClick={() => setModo("invitar")} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-tinta text-white"><Mail size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Invitar</span><span className="text-sm font-semibold text-tinta/60">Local o DJ → reclamar su ficha</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {modo === "local" && (
          <div>
            <button onClick={() => setModo("elegir")} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-magenta"><ArrowLeft size={16} /> Volver</button>
            <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-tarjeta ring-1 ring-black/5">
              {["Nombre del local", "Dirección", "Zona (aparecerá sola en filtros)", "Teléfono"].map((ph) => (
                <input key={ph} placeholder={ph} className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />
              ))}
              <button onClick={() => setHecho(true)} className="mt-1 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white active:scale-[0.98]">Crear local</button>
            </div>
          </div>
        )}

        {modo === "invitar" && (
          <div>
            <button onClick={() => setModo("elegir")} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-magenta"><ArrowLeft size={16} /> Volver</button>
            <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-tarjeta ring-1 ring-black/5">
              {["Nombre", "Email o WhatsApp"].map((ph) => (
                <input key={ph} placeholder={ph} className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />
              ))}
              <button onClick={() => setHecho(true)} className="mt-1 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white active:scale-[0.98]">Enviar invitación</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
