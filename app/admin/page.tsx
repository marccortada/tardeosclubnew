"use client";

import { useEffect, useState } from "react";
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
  CalendarDays, CalendarCheck, History, Store, Disc3, Users, BadgeCheck, MessageSquareWarning, ShieldCheck,
  CreditCard, Clock, Stethoscope, CalendarPlus, Megaphone, Flag, LineChart, ChevronRight, MapPin, LifeBuoy,
} from "lucide-react";

/**
 * Inicio del admin: cómo está la web y qué espera una decisión.
 *
 * Todo son lecturas pequeñas: recuentos con `head: true` y, como mucho, los 5
 * próximos tardeos. Nada de bajar tablas enteras para contarlas aquí.
 * Cobros, planes y estados NO se tocan desde esta pantalla.
 */
const CREAR = [
  { icon: CalendarPlus, label: "Tardeo", href: "/local/crear" },
  { icon: Store, label: "Local", href: "/admin/crear?tipo=local" },
  { icon: Megaphone, label: "Promotor", href: "/admin/crear?tipo=promotor" },
  { icon: Disc3, label: "DJ", href: "/admin/crear?tipo=dj" },
];

type Kpis = { proximos: number | null; pasados: number | null; locales: number | null; djs: number | null; usuarios: number | null };
type Proximo = { id: string; titulo: string; fecha: string; hora_inicio: string | null; zona: string | null; locales: { nombre: string | null } | null };

const n = (r: { count: number | null; error: unknown }) => (r.error ? null : r.count ?? 0);

export default function AdminInicio() {
  const [c, setC] = useState<Contadores | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [proximos, setProximos] = useState<Proximo[] | null>(null);
  const [errProximos, setErrProximos] = useState("");
  const [fallos, setFallos] = useState<number | null>(null);
  const [cobros, setCobros] = useState<boolean | null>(null);

  useEffect(() => {
    leerContadores().then(setC).catch(() => setC(null));
    revisarSalud().then(({ pruebas }) => setFallos(pruebas.filter((p) => !p.ok).length)).catch(() => setFallos(null));
    planesActivos().then(setCobros).catch(() => setCobros(false));

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
      visibles("id", cuenta).lt("fecha", hoy),
      supabase.from("locales").select("id", cuenta).eq("estado", "activo"),
      supabase.from("djs").select("id", cuenta),
      supabase.from("profiles").select("id", cuenta),
    ]).then(([t, p, l, d, u]) =>
      setKpis({ proximos: n(t), pasados: n(p), locales: n(l), djs: n(d), usuarios: n(u) }));

    visibles("id,titulo,fecha,hora_inicio,zona,locales(nombre)").gte("fecha", hoy)
      .order("fecha", { ascending: true }).order("hora_inicio", { ascending: true }).limit(5)
      .then(({ data, error }) => {
        if (error) { setErrProximos("No se pudieron cargar: " + error.message); setProximos([]); return; }
        setProximos((data ?? []) as unknown as Proximo[]);
      });
  }, []);

  const pendientes = c ? (c.resenas ?? 0) + (c.flyers ?? 0) + (c.reclamaciones ?? 0) + (c.localesPorVerificar ?? 0) : null;

  return (
    <SeccionPanel
      titulo="Inicio"
      descripcion={
        pendientes === null ? "Mirando qué hay pendiente…"
          : pendientes === 0 ? "Todo al día: no hay nada esperando tu decisión."
          : `${pendientes} ${pendientes === 1 ? "cosa espera" : "cosas esperan"} tu decisión.`
      }
      acciones={
        <Link href="/admin/estadisticas" className={claseBoton("contorno", "pequeno")}>
          <LineChart size={18} aria-hidden /> Estadísticas
        </Link>
      }
      ancho="ancho"
    >
      {/* Cifras de la web ahora mismo */}
      <section aria-label="La web ahora" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon={CalendarCheck} label="Tardeos próximos" valor={kpis?.proximos} href="/admin/tardeos" />
        <Kpi icon={History} label="Tardeos pasados" valor={kpis?.pasados} href="/admin/tardeos" />
        <Kpi icon={Store} label="Locales activos" valor={kpis?.locales} href="/admin/locales" />
        <Kpi icon={Disc3} label="DJs" valor={kpis?.djs} href="/admin/djs" />
        <Kpi icon={Users} label="Usuarios" valor={kpis?.usuarios} href="/admin/usuarios" />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">Necesita tu atención</h2>
          <div className="flex flex-col gap-3">
            <FilaAviso href="/admin/revisar" icono={<BadgeCheck size={22} aria-hidden />} titulo="Locales por verificar" sub="Fichas fuera de la web" valor={c?.localesPorVerificar ?? null} />
            <FilaAviso href="/admin/reclamaciones" icono={<Flag size={22} aria-hidden />} titulo="Reclamaciones" sub="Quién pide gestionar su ficha" valor={c?.reclamaciones ?? null} />
            <FilaAviso href="/admin/moderacion" icono={<MessageSquareWarning size={22} aria-hidden />} titulo="Reseñas por moderar" sub="Pendientes y apeladas" valor={c?.resenas ?? null} />
            <FilaAviso href="/admin/moderacion" icono={<ShieldCheck size={22} aria-hidden />} titulo="Flyers denunciados" valor={c?.flyers ?? null} />
            <FilaAviso href="/admin/incidencias" icono={<LifeBuoy size={22} aria-hidden />} titulo="Incidencias" sub="Avisos de la gente sin mirar" valor={c?.incidencias ?? null} />
            {/* La salud solo sale si algo falla: verde no aporta nada aquí. */}
            {fallos !== null && fallos > 0 && (
              <FilaAviso href="/admin/salud" icono={<Stethoscope size={22} aria-hidden />} titulo="Algo no va bien" sub="Lotes de SQL sin pegar o fallos" valor={fallos} />
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Próximos tardeos</h2>
            <Link href="/admin/tardeos" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-magenta-700 hover:underline">
              Ver todos <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
          {errProximos && <p className="mb-3 rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">{errProximos}</p>}
          {proximos === null ? (
            <div className="flex flex-col gap-2" aria-busy>
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[64px] animate-pulse rounded-xl bg-white ring-1 ring-linea" />)}
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
                        <span className="flex items-center gap-1 text-sm text-tinta-suave">
                          <span className="capitalize">{p.semana}</span>{t.hora_inicio ? ` · ${t.hora_inicio.slice(0, 5)}` : ""}
                          {lugar && <><MapPin size={14} className="ml-1 shrink-0" aria-hidden /><span className="truncate">{lugar}</span></>}
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

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Crear</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CREAR.map(({ icon: Icon, label, href }) => (
            <Link key={label} href={href}
              className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-linea bg-white px-4 text-[15px] font-bold shadow-tarjeta transition-colors hover:border-linea-fuerte hover:bg-marfil">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><Icon size={20} aria-hidden /></span>
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/*
        Dinero. Con los cobros apagados (`planes_activos`) los números de
        impagos y caducadas no significan nada: se enseña atenuado y dicho
        claramente, para que nadie crea que hay cobros en marcha.
      */}
      <section className="mt-8" aria-label="Dinero">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-bold">Dinero</h2>
          {cobros === false && (
            <span className="rounded-full bg-marfil-100 px-2.5 py-0.5 text-[13px] font-semibold text-tinta-suave">Desactivado</span>
          )}
        </div>
        {cobros === false ? (
          <Link href="/admin/suscripciones"
            className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-dashed border-linea-fuerte bg-marfil-100/60 p-4 text-tinta-suave transition-colors hover:bg-marfil-100">
            <CreditCard size={22} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold">Suscripciones desactivadas</span>
              <span className="block text-[15px]">No se cobra nada. Los planes se activarán más adelante.</span>
            </span>
            <ChevronRight size={20} className="shrink-0" aria-hidden />
          </Link>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <FilaAviso href="/admin/suscripciones" icono={<CreditCard size={22} aria-hidden />} titulo="Impagos" valor={c?.impagos ?? null} />
            <FilaAviso href="/admin/suscripciones" icono={<Clock size={22} aria-hidden />} titulo="Caducadas" valor={c?.caducadas ?? null} />
            <FilaAviso href="/admin/suscripciones" icono={<CalendarDays size={22} aria-hidden />} titulo="Vencen en 14 días" valor={c?.vencenPronto ?? null} urgente={false} />
          </div>
        )}
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
