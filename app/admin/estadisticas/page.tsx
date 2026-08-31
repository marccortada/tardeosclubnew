"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import {
  cargarResumen, tasaParaTi, tasaCompra, NOMBRES, ORDEN,
  RESUMEN_VACIO, type Resumen,
} from "@/lib/estadisticas";
import {
  Loader2, AlertTriangle, Users, Activity, Search, SlidersHorizontal,
  Sparkles, Ticket, TrendingUp,
} from "lucide-react";

const RANGOS = [
  { d: 7, label: "7 días" },
  { d: 30, label: "30 días" },
  { d: 90, label: "90 días" },
];

/**
 * Qué hace la gente en la web.
 *
 * Hasta ahora las estadísticas solo las veía cada local de lo suyo: quien
 * lleva el negocio no tenía dónde mirar. Aquí está lo agregado, sin señalar a
 * nadie —no hay ninguna pantalla de "qué hizo Fulano", y es deliberado—.
 *
 * El orden no es casual: sigue el camino de una persona, de por dónde entra a
 * lo que acaba haciendo. Leído de arriba abajo se ve dónde se cae la gente.
 */
export default function AdminEstadisticas() {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState<Resumen>(RESUMEN_VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (d: number) => {
    setCargando(true);
    const { datos, error } = await cargarResumen(d);
    setDatos(datos); setError(error); setCargando(false);
  }, []);
  useEffect(() => { cargar(dias); }, [cargar, dias]);

  const total = (k: string) => datos.por_tipo.find((x) => x.tipo === k)?.total ?? 0;
  const enOrden = useMemo(() => {
    const n = new Map(datos.por_tipo.map((x) => [x.tipo, x.total]));
    return ORDEN.filter((k) => (n.get(k) ?? 0) > 0).map((k) => ({ k, n: n.get(k) ?? 0 }));
  }, [datos.por_tipo]);
  const paraTi = tasaParaTi(datos);
  const compra = tasaCompra(datos);

  return (
    <main className="pb-16">
      <PanelHeader titulo="Estadísticas" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">

        {error && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <div className="mb-4 flex gap-2">
          {RANGOS.map((r) => (
            <button
              key={r.d} onClick={() => setDias(r.d)}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                dias === r.d ? "bg-marca text-white" : "bg-white text-tinta/60 ring-1 ring-black/5"}`}
            >{r.label}</button>
          ))}
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50">
            <Loader2 className="animate-spin" /> Cargando…
          </div>
        ) : datos.total === 0 ? (
          /* Se explica POR QUÉ está vacío. Un panel a cero sin más parece roto,
             y aquí no lo está: es que no hay tráfico que contar. */
          <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-black/5">
            <p className="font-display text-xl font-black">Todavía no hay nada que contar</p>
            <p className="mt-1 font-semibold text-tinta/60">
              No se ha registrado ninguna actividad en los últimos {dias} días.
              Se empieza a llenar solo en cuanto haya tardeos publicados y gente entrando.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Cifra icon={Activity} label="Acciones" valor={String(datos.total)} />
              <Cifra icon={Users} label="Personas" valor={String(datos.personas)}
                pie="por sesión, aprox." />
              <Cifra icon={TrendingUp} label="De ficha a comprar"
                valor={compra === null ? "—" : `${compra}%`}
                pie={compra === null ? "sin fichas vistas" : undefined} />
              <Cifra icon={Sparkles} label="«Para ti» pulsado"
                valor={paraTi === null ? "—" : `${paraTi}%`}
                pie={paraTi === null ? "aún no se ha enseñado" : undefined} />
            </section>

            <Bloque titulo="Qué pasa, por orden" icon={Activity}>
              {/* Barras relativas al máximo, no al total: con un tipo que se
                  lleva el 90 %, todas las demás saldrían del mismo ancho cero
                  y no se distinguiría la segunda de la última. */}
              <Barras filas={enOrden.map((x) => ({ etiqueta: NOMBRES[x.k] ?? x.k, valor: x.n }))} />
            </Bloque>

            {datos.busquedas.length > 0 && (
              <Bloque titulo="Qué busca la gente" icon={Search}
                pie="Las que no encuentran nada son las que dicen qué cartelera falta.">
                <ul className="flex flex-col gap-1.5">
                  {datos.busquedas.map((b) => (
                    <li key={b.texto} className="flex items-center gap-2 text-sm font-semibold">
                      <span className="flex-1 truncate">{b.texto}</span>
                      {b.sin_resultados > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">
                          {b.sin_resultados} sin resultados
                        </span>
                      )}
                      <span className="shrink-0 font-black text-tinta/50">{b.total}</span>
                    </li>
                  ))}
                </ul>
              </Bloque>
            )}

            {datos.filtros.length > 0 && (
              <Bloque titulo="Qué filtros se usan" icon={SlidersHorizontal}
                pie="Los que no salen aquí no los usa nadie: son candidatos a quitar.">
                <Barras filas={datos.filtros.map((x) => ({ etiqueta: x.filtro, valor: x.total }))} />
              </Bloque>
            )}

            {datos.ticketeras.length > 0 && (
              <Bloque titulo="A qué ticketera se va la gente" icon={Ticket}
                pie="Cuánto tráfico le mandas a cada una. Es el argumento para negociar.">
                <Barras filas={datos.ticketeras.map((x) => ({ etiqueta: x.dominio, valor: x.total }))} />
              </Bloque>
            )}

            {datos.top_tardeos.length > 0 && (
              <Bloque titulo="Tardeos más vistos" icon={Activity}>
                <Barras filas={datos.top_tardeos.map((x) => ({ etiqueta: x.titulo, valor: x.total }))} />
              </Bloque>
            )}

            {datos.top_locales.length > 0 && (
              <Bloque titulo="Locales más vistos" icon={Activity}>
                <Barras filas={datos.top_locales.map((x) => ({ etiqueta: x.nombre, valor: x.total }))} />
              </Bloque>
            )}

            {datos.top_djs.length > 0 && (
              <Bloque titulo="DJs más vistos" icon={Activity}>
                <Barras filas={datos.top_djs.map((x) => ({ etiqueta: x.nombre, valor: x.total }))} />
              </Bloque>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Cifra({
  icon: Icon, label, valor, pie,
}: {
  icon: typeof Activity; label: string; valor: string; pie?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
      <Icon size={20} className="text-magenta" />
      <p className="mt-2 font-display text-2xl font-black leading-none">{valor}</p>
      <p className="mt-1 text-xs font-bold text-tinta/60">{label}</p>
      {pie && <p className="text-xs font-semibold text-tinta/40">{pie}</p>}
    </div>
  );
}

function Bloque({
  titulo, icon: Icon, pie, children,
}: {
  titulo: string; icon: typeof Activity; pie?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
      <h2 className="flex items-center gap-2 font-display text-lg font-black">
        <Icon size={18} className="text-magenta" /> {titulo}
      </h2>
      {pie && <p className="mb-3 mt-0.5 text-xs font-semibold text-tinta/50">{pie}</p>}
      <div className={pie ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Barras({ filas }: { filas: { etiqueta: string; valor: number }[] }) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <ul className="flex flex-col gap-2">
      {filas.map((f) => (
        <li key={f.etiqueta}>
          <div className="flex items-baseline justify-between gap-2 text-sm font-bold">
            <span className="truncate">{f.etiqueta}</span>
            <span className="shrink-0 font-black text-tinta/50">{f.valor}</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-marca" style={{ width: `${(f.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
