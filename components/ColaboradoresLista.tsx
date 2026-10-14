"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LocalCard from "@/components/LocalCard";
import DjCard from "@/components/DjCard";
import TardeoCard from "@/components/TardeoCard";
import type { Tardeo } from "@/lib/types";
import { Store, Megaphone, Disc3, CalendarDays, Search, X } from "lucide-react";

type Pestana = "locales" | "promotores" | "eventos" | "djs";

/** Minúsculas y sin acentos: «mataro» encuentra «Mataró». */
const normalizar = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** ¿Algún campo contiene el texto buscado? */
const casa = (q: string, ...campos: unknown[]) => !q || campos.some((c) => normalizar(c).includes(q));

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
  const [texto, setTexto] = useState("");
  const q = normalizar(texto);
  const filaRef = useRef<HTMLDivElement>(null);

  // En el móvil la pestaña elegida (p. ej. DJs al llegar con ?ver=djs) puede
  // quedar fuera de la fila: se desplaza la fila, no la página, para verla.
  useEffect(() => {
    const activa = filaRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!activa) return;
    activa.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [ver]);

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

  // Son unos 130 en total: filtrar en memoria en cada tecla es instantáneo y
  // no merece una consulta al servidor.
  const { soloLocales, soloPromotores, djsVisibles, tardeosVisibles } = useMemo(() => {
    const ls = locales.filter((l) => casa(q, l.nombre, l.zona, l.direccion));
    return {
      soloLocales: ls.filter((l) => l.tipo !== "promotor"),
      soloPromotores: ls.filter((l) => l.tipo === "promotor"),
      djsVisibles: djs.filter((d) => casa(q, d.nombre_artistico, ...(Array.isArray(d.estilos) ? d.estilos : []))),
      tardeosVisibles: tardeos.filter((t) => casa(q, t.titulo, t.local?.nombre, t.zona)),
    };
  }, [locales, djs, tardeos, q]);

  const pestanas: { k: Pestana; label: string; icon: typeof Store; n: number }[] = [
    { k: "locales", label: "Locales", icon: Store, n: soloLocales.length },
    { k: "promotores", label: "Promotores", icon: Megaphone, n: soloPromotores.length },
    { k: "eventos", label: "Eventos", icon: CalendarDays, n: tardeosVisibles.length },
    { k: "djs", label: "DJs", icon: Disc3, n: djsVisibles.length },
  ];
  const vacia = q ? <SinResultados texto={texto} onBorrar={() => setTexto("")} /> : null;

  return (
    <>
      <div className="relative mb-4 md:max-w-xl">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre, pueblo o estilo"
          aria-label="Buscar locales, eventos y DJs por nombre, pueblo o estilo"
          // 16 px como mínimo: con menos, el iPhone hace zoom al tocar el campo.
          className="min-h-[52px] w-full rounded-2xl border border-linea-fuerte bg-white pl-12 pr-12 text-[16px] shadow-tarjeta [&::-webkit-search-cancel-button]:hidden outline-none transition placeholder:text-tinta-suave/80 focus:border-magenta focus:ring-4 focus:ring-magenta/15"
        />
        {texto && (
          <button onClick={() => setTexto("")} aria-label="Borrar búsqueda"
            className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-tinta-suave hover:bg-marfil-100">
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

      <div ref={filaRef} role="tablist" aria-label="Qué ver" className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scroll-padding-inline:1rem] md:mx-0 md:px-0">
        {pestanas.map(({ k, label, icon: Icon, n }) => (
          <button
            key={k}
            role="tab"
            aria-selected={ver === k}
            onClick={() => cambiar(k)}
            className={`inline-flex min-h-tacto shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[16px] font-semibold transition-colors ${
              ver === k
                ? "border-magenta bg-magenta text-white"
                : "border-linea-fuerte bg-white text-tinta hover:border-magenta/50"
            }`}
          >
            <Icon size={17} /> {label}
            <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${ver === k ? "bg-white/25" : "bg-marfil-100 text-tinta-suave"}`}>{n}</span>
          </button>
        ))}
      </div>

      {/* Las tres listas se pintan siempre y se esconde la que no toca. Con un
          condicional solo llegaba al HTML la pestaña activa, y como /djs es
          ahora un redirect aquí, los DJs sin tardeo se quedaban sin ningún
          enlace en toda la web: nadie los encontraría. Las fotos de las
          pestañas ocultas no se descargan (van en lazy y no están en pantalla),
          así que esto no cuesta tráfico. */}
      <Grupo activa={ver === "locales"} vacia={soloLocales.length === 0} sinResultados={vacia}>
        {soloLocales.map((l) => <LocalCard key={l.id} local={l} />)}
      </Grupo>
      <Grupo activa={ver === "promotores"} vacia={soloPromotores.length === 0} sinResultados={vacia}>
        {soloPromotores.map((l) => <LocalCard key={l.id} local={l} />)}
      </Grupo>
      {/* Los tardeos llevan flyer vertical: con cinco columnas quedaban
          diminutos, así que aquí una columna menos. */}
      <Grupo activa={ver === "eventos"} vacia={tardeosVisibles.length === 0} sinResultados={vacia} rejilla="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {tardeosVisibles.map((t) => <TardeoCard key={t.id} tardeo={t} />)}
      </Grupo>
      <Grupo activa={ver === "djs"} vacia={djsVisibles.length === 0} sinResultados={vacia}>
        {djsVisibles.map((dj) => <DjCard key={dj.id} dj={dj} />)}
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
  sinResultados,
  rejilla = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
  children,
}: {
  activa: boolean;
  vacia: boolean;
  /** Lo que se enseña si está vacía POR la búsqueda (null = no hay búsqueda). */
  sinResultados: React.ReactNode;
  rejilla?: string;
  children: React.ReactNode;
}) {
  return (
    <div hidden={!activa}>
      {vacia ? (
        sinResultados ?? (
          <p className="rounded-2xl border border-linea bg-white p-6 text-center text-[16px] font-semibold text-tinta-suave">
            Aún no hay nada por aquí.
          </p>
        )
      ) : (
        <div className={`grid gap-3 sm:gap-4 lg:gap-5 ${rejilla}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Búsqueda sin coincidencias: se dice qué se buscó y cómo salir. */
function SinResultados({ texto, onBorrar }: { texto: string; onBorrar: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-8 text-center">
      <p className="text-lg font-bold">Nada con «{texto.trim()}» en esta pestaña</p>
      <p className="mx-auto mt-1 max-w-md text-[16px] text-tinta-suave">
        Prueba con otra palabra o mira las otras pestañas: el número de cada una ya cuenta tu búsqueda.
      </p>
      <button onClick={onBorrar} className="mt-4 inline-flex min-h-tacto items-center gap-1.5 rounded-xl border border-linea-fuerte bg-white px-5 font-bold hover:bg-marfil">
        <X size={18} aria-hidden /> Borrar búsqueda
      </button>
    </div>
  );
}
