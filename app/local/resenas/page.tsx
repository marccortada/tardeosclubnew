"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, ExternalLink } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { EstadoLista } from "@/components/panel/Paginacion";
import PanelFiltros, { CampoFiltro, claseFiltro, SelectorOrden } from "@/components/panel/PanelFiltros";
import { useFicha } from "../_panel/PanelLocal";
import { getResenasAprobadas, type Resena } from "@/lib/resenas";

const POR_PAGINA = 25;
type Orden = "recientes" | "antiguas" | "mejores" | "peores";

/**
 * Lo que dice la gente del local: solo las reseñas ya aprobadas, que son las
 * que se ven en la ficha pública. Las pendientes o rechazadas las modera el
 * equipo; enseñárselas al local abriría la puerta a presionar para quitarlas.
 */
export default function ResenasLocal() {
  const { ficha, esPromotor } = useFicha();
  const [resenas, setResenas] = useState<Resena[] | null>(null);
  const [pagina, setPagina] = useState(1);
  // Filtros sobre la lista ya cargada (son todas las aprobadas del local), así
  // que no se pierde ninguna fuera de la página visible.
  const [nota, setNota] = useState("");
  const [conTexto, setConTexto] = useState(false);
  const [orden, setOrden] = useState<Orden>("recientes");
  const activos = [nota, conTexto, orden !== "recientes"].filter(Boolean).length;
  const limpiarFiltros = () => { setNota(""); setConTexto(false); setOrden("recientes"); setPagina(1); };

  useEffect(() => {
    let vivo = true;
    setResenas(null); setPagina(1);
    getResenasAprobadas("local", ficha.id).then((r) => vivo && setResenas(r));
    return () => { vivo = false; };
  }, [ficha.id]);

  const lista = useMemo(() => resenas ?? [], [resenas]);
  const media = lista.length ? lista.reduce((s, r) => s + r.puntuacion, 0) / lista.length : 0;
  const filtrada = useMemo(() => {
    const f = lista.filter((r) => (!nota || r.puntuacion === Number(nota)) && (!conTexto || !!r.comentario?.trim()));
    const fecha = (a: Resena, b: Resena) => b.created_at.localeCompare(a.created_at);
    if (orden === "antiguas") return [...f].sort((a, b) => fecha(b, a));
    if (orden === "mejores") return [...f].sort((a, b) => b.puntuacion - a.puntuacion || fecha(a, b));
    if (orden === "peores") return [...f].sort((a, b) => a.puntuacion - b.puntuacion || fecha(a, b));
    return [...f].sort(fecha);
  }, [lista, nota, conTexto, orden]);
  const pag = filtrada.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <SeccionPanel
      titulo="Reseñas"
      descripcion={`Lo que opina la gente ${esPromotor ? "de tus eventos" : "de tu local"}. Solo salen las que ya hemos revisado y se ven en tu ficha.`}
      acciones={
        <Link href={`/locales/${ficha.id}`} target="_blank"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-linea-fuerte bg-white px-4 text-[15px] font-semibold hover:bg-marfil-100">
          <ExternalLink size={16} aria-hidden /> Ver en mi ficha
        </Link>
      }
    >
      {lista.length > 0 && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
          <span className="text-[34px] font-bold leading-none">{media.toFixed(1)}</span>
          <div>
            <Estrellas n={Math.round(media)} />
            <p className="mt-1 text-[15px] text-tinta-suave">{lista.length} {lista.length === 1 ? "reseña" : "reseñas"}</p>
          </div>
        </div>
      )}

      {lista.length > 0 && (
        <div className="mb-4">
          <PanelFiltros clave="local-resenas" activos={activos} onLimpiar={limpiarFiltros}>
            <CampoFiltro etiqueta="Puntuación">
              <select value={nota} onChange={(e) => { setNota(e.target.value); setPagina(1); }} className={claseFiltro}>
                <option value="">Todas</option>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 1 ? "estrella" : "estrellas"}</option>)}
              </select>
            </CampoFiltro>
            <SelectorOrden<Orden> valor={orden} onCambiar={(o) => { setOrden(o); setPagina(1); }} opciones={[
              { clave: "recientes", label: "Más recientes" },
              { clave: "antiguas", label: "Más antiguas" },
              { clave: "mejores", label: "Mejor puntuación" },
              { clave: "peores", label: "Peor puntuación" },
            ]} />
            <label className="flex min-h-[44px] items-center gap-2 self-end rounded-xl border border-linea-fuerte bg-white px-3 text-[15px]">
              <input type="checkbox" checked={conTexto} onChange={(e) => { setConTexto(e.target.checked); setPagina(1); }} className="h-5 w-5 accent-magenta" />
              Solo con comentario
            </label>
          </PanelFiltros>
        </div>
      )}

      <EstadoLista
        cargando={resenas === null}
        error={null}
        vacio={lista.length > 0
          ? "Ninguna reseña con estos filtros."
          : "Todavía no tienes reseñas. Las deja la gente desde tu ficha pública después de ir: compártela tras cada tardeo."}
        filas={filtrada.length}
      />

      {pag.length > 0 && (
        <ul className="flex flex-col gap-3">
          {pag.map((r) => (
            <li key={r.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Estrellas n={r.puntuacion} />
                <span className="text-sm text-tinta-suave">
                  {new Date(r.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              {r.comentario
                ? <p className="mt-2 whitespace-pre-line text-[16px]">{r.comentario}</p>
                : <p className="mt-2 text-[15px] italic text-tinta-suave">Sin comentario, solo puntuación.</p>}
              <p className="mt-2 text-sm font-semibold text-tinta-suave">{r.profiles?.display_name || "Tardícola"}</p>
            </li>
          ))}
        </ul>
      )}
      <Paginacion pagina={pagina} total={filtrada.length} porPagina={POR_PAGINA} onCambiar={setPagina} />
    </SeccionPanel>
  );
}

function Estrellas({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={18} aria-hidden className={i <= n ? "text-oro" : "text-linea-fuerte"} fill={i <= n ? "currentColor" : "none"} />
      ))}
    </span>
  );
}
