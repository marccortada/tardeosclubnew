"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { SeccionPanel } from "@/components/panel/PanelShell";
import FilaAviso from "@/components/admin/FilaAviso";
import { supabase } from "@/lib/supabase";
import { leerContadores, type Contadores } from "@/lib/adminContadores";
import { revisarSalud } from "@/lib/salud";
import { planesActivos } from "@/lib/ajustes";
import { hoyISO } from "@/lib/tardeos";
import { partesFecha } from "@/components/admin/fechas";
import { claseBoton } from "@/components/Boton";
import {
  CalendarCheck, Store, Disc3, Users, BadgeCheck, MessageSquareWarning, ShieldCheck, ListTodo, CheckCircle2,
  CreditCard, Clock, Stethoscope, CalendarPlus, Flag, ChevronRight, MapPin, LifeBuoy, Plus,
} from "lucide-react";

/**
 * Inicio del admin: SOLO lo que pide algo hoy.
 *
 * Antes era un tablero con todo (cinco cifras, ocho avisos aunque estuvieran
 * a cero, accesos para crear, dinero apagado…) y en el móvil había que bajar
 * cuatro pantallas para ver si había algo que hacer. Ahora, por orden: lo
 * pendiente (solo lo que no está a cero), los próximos tardeos y cuatro
 * cifras. Lo demás vive en su sección del menú.
 *
 * Todo son lecturas pequeñas: recuentos con `head: true` y, como mucho, los 5
 * próximos tardeos. Nada de bajar tablas enteras para contarlas aquí.
 * Cobros, planes y estados NO se tocan desde esta pantalla.
 */
type Kpis = { proximos: number | null; locales: number | null; djs: number | null; usuarios: number | null };
type Proximo = { id: string; titulo: string; fecha: string; hora_inicio: string | null; zona: string | null; locales: { nombre: string | null } | null };

const n = (r: { count: number | null; error: unknown }) => (r.error ? null : r.count ?? 0);

export default function AdminInicio() {
  const [c, setC] = useState<Contadores | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [proximos, setProximos] = useState<Proximo[] | null>(null);
  const [errProximos, setErrProximos] = useState("");
  const [fallos, setFallos] = useState<number | null>(null);
  const [cobros, setCobros] = useState<boolean | null>(null);
  /** Abiertas en la cola de trabajo (lote 69). null = sin lote o sin leer. */
  const [cola, setCola] = useState<number | null>(null);

  useEffect(() => {
    leerContadores().then(setC).catch(() => setC(null));
    revisarSalud().then(({ pruebas }) => setFallos(pruebas.filter((p) => !p.ok).length)).catch(() => setFallos(null));
    planesActivos().then(setCobros).catch(() => setCobros(false));
    // Solo el total: se pide una fila y la RPC trae la cuenta en `total`.
    supabase.rpc("cola_trabajo", { p_tipo: null, p_zona: null, p_solo_mias: false, p_estado: "abiertas", p_limite: 1, p_desde: 0 })
      .then(({ data, error }) => setCola(error ? null : ((data as { total: number }[] | null)?.[0]?.total ?? 0)), () => setCola(null));

    /**
     * "Visible" = publicado, o programado cuya hora ya llegó: lo mismo que
     * enseña la web. Contar publicados sin mirar la fecha hizo que el panel
     * dijera "26 activos" con el mapa vacío; por eso los pasados van aparte.
     */
    const hoy = hoyISO();
    const visibles = (cols: string, opts?: { count: "exact"; head: true }) =>
      supabase.from("tardeos").select(cols, opts)
        .or(`estado.eq.publicado,and(estado.eq.programado,publicar_en.lte.${new Date().toISOString()})`);
    const cuenta = { count: "exact", head: true } as const;

    Promise.all([
      visibles("id", cuenta).gte("fecha", hoy),
      supabase.from("locales").select("id", cuenta).eq("estado", "activo"),
      supabase.from("djs").select("id", cuenta),
      supabase.from("profiles").select("id", cuenta),
    ]).then(([t, l, d, u]) =>
      setKpis({ proximos: n(t), locales: n(l), djs: n(d), usuarios: n(u) }));

    visibles("id,titulo,fecha,hora_inicio,zona,locales(nombre)").gte("fecha", hoy)
      .order("fecha", { ascending: true }).order("hora_inicio", { ascending: true }).limit(5)
      .then(({ data, error }) => {
        if (error) { setErrProximos("No se pudieron cargar: " + error.message); setProximos([]); return; }
        setProximos((data ?? []) as unknown as Proximo[]);
      });
  }, []);

  // Lo que pide algo. Cada fila sale SOLO si hay algo (o si no se pudo leer:
  // "—" avisa de que falta un dato; un 0 escondido no engaña a nadie).
  const filas: { clave: string; href: string; icono: ReactNode; titulo: string; valor: number | null }[] = [
    { clave: "cola", href: "/admin/cola", icono: <ListTodo size={22} aria-hidden />, titulo: "Cola de trabajo", valor: cola },
    { clave: "verificar", href: "/admin/revisar", icono: <BadgeCheck size={22} aria-hidden />, titulo: "Locales por verificar", valor: c ? c.localesPorVerificar : 0 },
    { clave: "reclamaciones", href: "/admin/reclamaciones", icono: <Flag size={22} aria-hidden />, titulo: "Reclamaciones", valor: c ? c.reclamaciones : 0 },
    { clave: "resenas", href: "/admin/moderacion", icono: <MessageSquareWarning size={22} aria-hidden />, titulo: "Reseñas por moderar", valor: c ? c.resenas : 0 },
    { clave: "flyers", href: "/admin/moderacion", icono: <ShieldCheck size={22} aria-hidden />, titulo: "Flyers denunciados", valor: c ? c.flyers : 0 },
    { clave: "incidencias", href: "/admin/incidencias", icono: <LifeBuoy size={22} aria-hidden />, titulo: "Avisos de la gente", valor: c ? c.incidencias : 0 },
    { clave: "salud", href: "/admin/salud", icono: <Stethoscope size={22} aria-hidden />, titulo: "Fallos en la base", valor: fallos ?? 0 },
    // Dinero solo cuando haya cobros: apagados, impagos y caducadas no significan nada.
    ...(cobros ? [
      { clave: "impagos", href: "/admin/suscripciones", icono: <CreditCard size={22} aria-hidden />, titulo: "Impagos", valor: c ? c.impagos : 0 },
      { clave: "caducadas", href: "/admin/suscripciones", icono: <Clock size={22} aria-hidden />, titulo: "Suscripciones caducadas", valor: c ? c.caducadas : 0 },
    ] : []),
  ].filter((f) => f.valor === null ? f.clave !== "cola" : f.valor > 0);
  // La cola sin lote 69 no es un aviso: simplemente no existe todavía.

  const pendientes = c ? (c.resenas ?? 0) + (c.flyers ?? 0) + (c.reclamaciones ?? 0) + (c.localesPorVerificar ?? 0) + (c.incidencias ?? 0) : null;
  const leido = c !== null && fallos !== null;

  return (
    <SeccionPanel
      titulo="Inicio"
      descripcion={
        pendientes === null ? "Mirando qué hay pendiente…"
          : pendientes === 0 ? "Todo al día: no hay nada esperando tu decisión."
          : `${pendientes} ${pendientes === 1 ? "cosa espera" : "cosas esperan"} tu decisión.`
      }
      acciones={
        // En el móvil «Crear nuevo» de la barra solo se ve abriendo el menú.
        <Link href="/admin/crear" className={claseBoton("primario", "pequeno", false, "lg:hidden")}>
          <Plus size={18} aria-hidden /> Crear nuevo
        </Link>
      }
      ancho="ancho"
    >
      {/* grid-cols-1 (= minmax(0,1fr)) y min-w-0: sin ellos un título largo de
          «Próximos tardeos» ensanchaba la columna y a 375 px las tarjetas de
          «Para hoy» se salían de la pantalla (436 px). */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-labelledby="hoy" className="min-w-0">
          <h2 id="hoy" className="mb-3 text-lg font-bold">Para hoy</h2>
          {!leido ? (
            <div className="flex flex-col gap-3" aria-busy>
              {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
            </div>
          ) : filas.length === 0 ? (
            <p className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-linea bg-white p-4 text-[16px] font-semibold text-ok shadow-tarjeta">
              <CheckCircle2 size={22} className="shrink-0" aria-hidden /> Nada pendiente. Buen trabajo.
            </p>
          ) : (
            <div className="flex min-w-0 flex-col gap-3 [&>a]:min-w-0">
              {filas.map((f) => <FilaAviso key={f.clave} href={f.href} icono={f.icono} titulo={f.titulo} valor={f.valor} />)}
            </div>
          )}
        </section>

        <section aria-labelledby="proximos" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="proximos" className="text-lg font-bold">Próximos tardeos</h2>
            <Link href="/admin/tardeos" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-magenta-700 hover:underline">
              Ver todos <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
          {errProximos && <p className="mb-3 rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">{errProximos}</p>}
          {proximos === null ? (
            <div className="flex flex-col gap-2" aria-busy>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[64px] animate-pulse rounded-xl bg-white ring-1 ring-linea" />)}
            </div>
          ) : proximos.length === 0 && !errProximos ? (
            <div className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center text-[15px] text-tinta-suave">
              No hay tardeos publicados de hoy en adelante.
              <Link href="/local/crear" className={claseBoton("primario", "pequeno", false, "mt-3")}>
                <CalendarPlus size={18} aria-hidden /> Crear un tardeo
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white">
              {proximos.map((t) => {
                const p = partesFecha(t.fecha);
                const lugar = [t.locales?.nombre, t.zona].filter(Boolean).join(" · ");
                return (
                  <li key={t.id}>
                    <Link href={`/tardeos/${t.id}`} target="_blank" className="flex items-center gap-3 p-3 hover:bg-marfil">
                      <span className="grid h-12 w-12 shrink-0 place-content-center rounded-xl bg-magenta-50 text-center text-magenta-700">
                        <span className="text-lg font-bold leading-none">{p.dia}</span>
                        <span className="text-[11px] font-semibold uppercase">{p.mes}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{t.titulo}</span>
                        <span className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-tinta-suave">
                          <span className="capitalize">{p.semana}</span>{t.hora_inicio ? ` · ${t.hora_inicio.slice(0, 5)}` : ""}
                          {lugar && <span className="flex min-w-0 items-center gap-1"><MapPin size={14} className="ml-1 shrink-0" aria-hidden /><span className="truncate">{lugar}</span></span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Cuatro cifras de la web ahora mismo; el detalle, en Estadísticas. */}
      <section aria-label="La web ahora" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 [&>a]:min-w-0">
        <Kpi icon={CalendarCheck} label="Tardeos próximos" valor={kpis?.proximos} href="/admin/tardeos" />
        <Kpi icon={Store} label="Locales activos" valor={kpis?.locales} href="/admin/locales" />
        <Kpi icon={Disc3} label="DJs" valor={kpis?.djs} href="/admin/djs" />
        <Kpi icon={Users} label="Usuarios" valor={kpis?.usuarios} href="/admin/usuarios" />
      </section>
    </SeccionPanel>
  );
}

function Kpi({ icon: Icon, label, valor, href }: { icon: typeof Store; label: string; valor: number | null | undefined; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta transition-colors hover:border-linea-fuerte">
      <Icon size={20} className="text-magenta" aria-hidden />
      <p className="mt-2 text-[28px] font-extrabold leading-none tabular-nums">
        {valor === undefined ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-marfil-100 align-middle" /> : valor === null ? "—" : valor.toLocaleString("es-ES")}
      </p>
      <p className="mt-1.5 text-[15px] font-medium text-tinta-suave">{label}</p>
    </Link>
  );
}
