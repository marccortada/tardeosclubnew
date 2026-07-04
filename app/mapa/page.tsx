"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

const MapaClient = dynamic(() => import("@/components/MapaClient"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center rounded-2xl bg-[#dce7dd]">
      <span className="font-bold text-tinta/50">Cargando mapa…</span>
    </div>
  ),
});

export default function Mapa() {
  return (
    <main className="mx-auto flex h-[calc(100vh-120px)] max-w-6xl flex-col px-4 pt-6 md:h-[calc(100vh-140px)] md:px-8">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="text-magenta" />
        <h1 className="font-display text-2xl font-black md:text-4xl">Mapa de tardeos</h1>
      </div>
      <p className="mb-3 text-sm font-bold text-tinta/60">
        Cada logo es un tardeo · borde <span className="text-oro-600">dorado</span> = destacado. Pulsa para ver el flyer y apuntarte.
      </p>
      <div className="flex-1 overflow-hidden rounded-2xl ring-1 ring-magenta-100">
        <MapaClient />
      </div>
    </main>
  );
}
