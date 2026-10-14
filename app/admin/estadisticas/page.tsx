"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Filtros } from "@/components/panel/Paginacion";
import Aviso from "@/components/admin/Aviso";
import {
  cargarResumen, tasaParaTi, tasaCompra, NOMBRES, ORDEN,
  RESUMEN_VACIO, type Resumen,
} from "@/lib/estadisticas";
import {
  Users, Activity, Search, SlidersHorizontal,
  Sparkles, Ticket, TrendingUp,
} from "lucide-react";

const RANGOS = [
  { clave: "7", label: "7 días" },
  { clave: "30", label: "30 días" },
  { clave: "90", label: "90 días" },
] as const;

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

  // Turno de la última petición: al pasar de 90 a 7 días deprisa, la respuesta
  // lenta de 90 podía llegar después y pintarse bajo la pestaña de 7.
  const turno = useRef(0);
  const cargar = useCallback(async (d: number) => {
    const mio = ++turno.current;
    setCargando(true);
    const { datos, error } = await cargarResumen(d);
    if (mio !== turno.current) return;
    setDatos(datos); setError(error); setCargando(false);
  }, []);
  useEffect(() => { cargar(dias); }, [cargar, dias]);

  const enOrden = useMemo(() => {
    const n = new Map(datos.por_tipo.map((x) => [x.tipo, x.total]));
    return ORDEN.filter((k) => (n.get(k) ?? 0) > 0).map((k) => ({ k, n: n.get(k) ?? 0 }));
  }, [datos.por_tipo]);
  const paraTi = tasaParaTi(datos);
  const compra = tasaCompra(datos);

  return (
    <SeccionPanel
      titulo="Estadísticas"
      descripcion="Qué hace la gente en la web, de por dónde entra a lo que acaba haciendo. Datos agregados, sin señalar a nadie."
    >
      {error && <Aviso tono="aviso">{error}</Aviso>}

      <div className="mb-5">
        <Filtros<(typeof RANGOS)[number]["clave"]>
          valor={String(dias) as (typeof RANGOS)[number]["clave"]}
          onCambiar={(k) => setDias(Number(k))}
          opciones={RANGOS.map((r) => ({ clave: r.clave, label: r.label }))}
        />
      </div>

      {cargando ? (
        <div className="flex flex-col gap-4" aria-busy>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
          </div>
          <div className="h-[220px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />
        </div>
      ) : datos.total === 0 ? (
        /* Se explica POR QUÉ está vacío. Un panel a cero sin más parece roto,
           y aquí no lo está: es que no hay tráfico que contar. */
        <div className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-8 text-center">
          <p className="text-lg font-bold">Todavía no hay nada que contar</p>
          <p className="mt-1 text-[15px] text-tinta-suave">
            No se ha registrado actividad en los últimos {dias} días.
            Se llena sola en cuanto haya tardeos publicados y gente entrando.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra icon={Activity} label="Acciones" valor={datos.total.toLocaleString("es-ES")} />
            <Cifra icon={Users} label="Personas" valor={datos.personas.toLocaleString("es-ES")} pie="por sesión, aprox." />
            <Cifra icon={TrendingUp} label="De ficha a comprar"
              valor={compra === null ? "—" : `${compra}%`}
              pie={compra === null ? "sin fichas vistas" : undefined} />
            <Cifra icon={Sparkles} label="«Para ti» pulsado"
              valor={paraTi === null ? "—" : `${paraTi}%`}
              pie={paraTi === null ? "aún no se ha enseñado" : undefined} />
          </section>

          <Bloque titulo="Qué pasa, por orden" icon={Activity}>
            {/* Barras relativas al máximo, no al total: con un tipo que se
                lleva el 90 %, todas las demás saldrían del mismo ancho cero. */}
            <Barras filas={enOrden.map((x) => ({ etiqueta: NOMBRES[x.k] ?? x.k, valor: x.n }))} />
          </Bloque>

          <div className="grid gap-5 lg:grid-cols-2">
            {datos.busquedas.length > 0 && (
              <Bloque titulo="Qué busca la gente" icon={Search}
                pie="Las que no encuentran nada dicen qué cartelera falta.">
                <ul className="flex flex-col gap-2">
                  {datos.busquedas.map((b) => (
                    <li key={b.texto} className="flex items-center gap-2 text-[15px]">
                      <span className="flex-1 truncate">{b.texto}</span>
                      {b.sin_resultados > 0 && (
                        <span className="shrink-0 rounded-full bg-aviso-fondo px-2 py-0.5 text-[13px] font-semibold text-aviso">
                          {b.sin_resultados} sin resultados
                        </span>
                      )}
                      <span className="shrink-0 font-semibold tabular-nums text-tinta-suave">{b.total}</span>
                    </li>
                  ))}
                </ul>
              </Bloque>
            )}

            {datos.filtros.length > 0 && (
              <Bloque titulo="Qué filtros se usan" icon={SlidersHorizontal}
                pie="Los que no salen aquí no los usa nadie: candidatos a quitar.">
                <Barras filas={datos.filtros.map((x) => ({ etiqueta: x.filtro, valor: x.total }))} />
              </Bloque>
            )}

            {datos.ticketeras.length > 0 && (
              <Bloque titulo="A qué ticketera se va la gente" icon={Ticket}
                pie="Cuánto tráfico mandas a cada una: argumento para negociar.">
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
        </div>
      )}
    </SeccionPanel>
  );
}

function Cifra({
  icon: Icon, label, valor, pie,
}: {
  icon: typeof Activity; label: string; valor: string; pie?: string;
}) {
  return (
    <div className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
      <Icon size={20} className="text-magenta" aria-hidden />
      <p className="mt-2 text-[26px] font-extrabold leading-none tabular-nums">{valor}</p>
      <p className="mt-1.5 text-[15px] font-medium text-tinta-suave">{label}</p>
      {pie && <p className="text-[13px] text-tinta-suave">{pie}</p>}
    </div>
  );
}

function Bloque({
  titulo, icon: Icon, pie, children,
}: {
  titulo: string; icon: typeof Activity; pie?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon size={18} className="text-magenta" aria-hidden /> {titulo}
      </h2>
      {pie && <p className="mb-3 mt-0.5 text-sm text-tinta-suave">{pie}</p>}
      <div className={pie ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Barras({ filas }: { filas: { etiqueta: string; valor: number }[] }) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {filas.map((f) => (
        <li key={f.etiqueta}>
          <div className="flex items-baseline justify-between gap-2 text-[15px]">
            <span className="truncate">{f.etiqueta}</span>
            <span className="shrink-0 font-semibold tabular-nums text-tinta-suave">{f.valor.toLocaleString("es-ES")}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-marfil-100">
            <div className="h-full rounded-full bg-magenta" style={{ width: `${(f.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
