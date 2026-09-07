"use client";

import { useEffect, useState } from "react";
import LocalCard from "@/components/LocalCard";
import DjCard from "@/components/DjCard";
import TardeoCard from "@/components/TardeoCard";
import type { Tardeo } from "@/lib/types";
import { Store, Megaphone, Disc3, CalendarDays } from "lucide-react";

type Pestana = "locales" | "promotores" | "eventos" | "djs";

/**
 * Las tres pestañas del directorio. Los datos llegan ya cargados del servidor:
 * cambiar de pestaña es filtrar en memoria, sin esperas.
 *
 * OJO con leer la URL: con `useSearchParams()` Next saca toda esta sección del
 * renderizado de servidor, y el HTML se queda sin una sola ficha — un
 * directorio de negocios que Google indexa vacío. Por eso el parámetro se lee
 * después de hidratar: el servidor pinta las tarjetas y el enlace profundo
 * (?ver=djs, el que usa el redirect del antiguo /djs) se aplica al montar.
 */
export default function ColaboradoresLista({
  locales,
  djs,
  tardeos,
}: {
  locales: any[];
  djs: any[];
  /** Los tardeos publicados, para la pestaña de Eventos (E-08). */
  tardeos: Tardeo[];
}) {
  const [ver, setVer] = useState<Pestana>("locales");

  /**
   * La pestaña se refleja en la dirección, y la dirección la elige.
   *
   * Sin esto, «mándame el directorio de DJs» era «entra en colaboradores y
   * pulsa la tercera pestaña». Ahora /colaboradores?ver=djs es un enlace que
   * se puede mandar, guardar en favoritos y volver atrás.
   *
   * Se usa `replaceState` y no `push`: cambiar de pestaña no es navegar, y
   * llenar el historial obliga a pulsar Atrás cinco veces para salir de la
   * página. Y se lee después de hidratar, no con `useSearchParams`, porque eso
   * saca toda la sección del renderizado de servidor y Google indexaría un
   * directorio de negocios vacío.
   */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("ver");
    if (p === "djs" || p === "promotores" || p === "eventos") setVer(p);
  }, []);

  const cambiar = (k: Pestana) => {
    setVer(k);
    try {
      const u = new URL(window.location.href);
      if (k === "locales") u.searchParams.delete("ver");
      else u.searchParams.set("ver", k);
      window.history.replaceState(null, "", u);
    } catch { /* si el navegador no deja tocar el historial, la pestaña cambia igual */ }
  };

  const soloLocales = locales.filter((l) => l.tipo !== "promotor");
  const soloPromotores = locales.filter((l) => l.tipo === "promotor");

  const pestanas: { k: Pestana; label: string; icon: typeof Store; n: number }[] = [
    { k: "locales", label: "Locales", icon: Store, n: soloLocales.length },
    { k: "promotores", label: "Promotores", icon: Megaphone, n: soloPromotores.length },
    { k: "eventos", label: "Eventos", icon: CalendarDays, n: tardeos.length },
    { k: "djs", label: "DJs", icon: Disc3, n: djs.length },
  ];

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {pestanas.map(({ k, label, icon: Icon, n }) => (
          <button
            key={k}
            onClick={() => cambiar(k)}
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

      {/* Las tres listas se pintan siempre y se esconde la que no toca. Con un
          condicional solo llegaba al HTML la pestaña activa, y como /djs es
          ahora un redirect aquí, los DJs sin tardeo se quedaban sin ningún
          enlace en toda la web: nadie los encontraría. Las fotos de las
          pestañas ocultas no se descargan (van en lazy y no están en pantalla),
          así que esto no cuesta tráfico. */}
      <Grupo activa={ver === "locales"} vacia={soloLocales.length === 0}>
        {soloLocales.map((l) => <LocalCard key={l.id} local={l} />)}
      </Grupo>
      <Grupo activa={ver === "promotores"} vacia={soloPromotores.length === 0}>
        {soloPromotores.map((l) => <LocalCard key={l.id} local={l} />)}
      </Grupo>
      <Grupo activa={ver === "eventos"} vacia={tardeos.length === 0}>
        {tardeos.map((t) => <TardeoCard key={t.id} tardeo={t} />)}
      </Grupo>
      <Grupo activa={ver === "djs"} vacia={djs.length === 0}>
        {djs.map((dj) => <DjCard key={dj.id} dj={dj} />)}
      </Grupo>
    </>
  );
}

/** Una pestaña. Fuera del componente padre a propósito: definida dentro, React
 *  la trataría como un tipo nuevo en cada render y remontaría todas las
 *  tarjetas —y sus imágenes— cada vez que se cambia de pestaña. */
function Grupo({
  activa,
  vacia,
  children,
}: {
  activa: boolean;
  vacia: boolean;
  children: React.ReactNode;
}) {
  return (
    <div hidden={!activa}>
      {vacia ? (
        <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
          Aún no hay nada por aquí.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {children}
        </div>
      )}
    </div>
  );
}
