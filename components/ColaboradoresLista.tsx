"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import LocalCard from "@/components/LocalCard";
import DjCard from "@/components/DjCard";
import { Store, Megaphone, Disc3 } from "lucide-react";

type Pestana = "locales" | "promotores" | "djs";

/**
 * Las tres pestañas del directorio. Los datos llegan ya cargados del servidor:
 * cambiar de pestaña es filtrar en memoria, sin esperas.
 *
 * La pestaña inicial se puede fijar por URL (?ver=djs), que es lo que usa el
 * redirect del antiguo /djs para que los enlaces de fuera sigan valiendo.
 */
export default function ColaboradoresLista({
  locales,
  djs,
}: {
  locales: any[];
  djs: any[];
}) {
  const inicial = useSearchParams().get("ver");
  const [ver, setVer] = useState<Pestana>(
    inicial === "djs" ? "djs" : inicial === "promotores" ? "promotores" : "locales"
  );

  const soloLocales = locales.filter((l) => l.tipo !== "promotor");
  const soloPromotores = locales.filter((l) => l.tipo === "promotor");

  const pestanas: { k: Pestana; label: string; icon: typeof Store; n: number }[] = [
    { k: "locales", label: "Locales", icon: Store, n: soloLocales.length },
    { k: "promotores", label: "Promotores", icon: Megaphone, n: soloPromotores.length },
    { k: "djs", label: "DJs", icon: Disc3, n: djs.length },
  ];

  const vacio = (
    <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
      Aún no hay nada por aquí.
    </p>
  );

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {pestanas.map(({ k, label, icon: Icon, n }) => (
          <button
            key={k}
            onClick={() => setVer(k)}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold transition ${
              ver === k
                ? "bg-magenta text-white"
                : "bg-white text-tinta/80 ring-1 ring-magenta-100 hover:ring-magenta"
            }`}
          >
            <Icon size={17} /> {label}
            <span className={ver === k ? "text-white/70" : "text-tinta/40"}>{n}</span>
          </button>
        ))}
      </div>

      {ver === "djs" ? (
        djs.length === 0 ? vacio : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {djs.map((dj) => <DjCard key={dj.id} dj={dj} />)}
          </div>
        )
      ) : (
        (() => {
          const lista = ver === "locales" ? soloLocales : soloPromotores;
          if (lista.length === 0) return vacio;
          return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
              {lista.map((l) => <LocalCard key={l.id} local={l} />)}
            </div>
          );
        })()
      )}
    </>
  );
}
