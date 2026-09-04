"use client";
import Image from "next/image";

import { useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import ServiciosExternos from "@/components/ServiciosExternos";
import PromocionModal from "@/components/PromocionModal";
import GestionFotosLocal from "@/components/GestionFotosLocal";
import { useAuth } from "@/lib/useAuth";
import { getMiLocal, getTardeosDeLocal, getMetricasLocal, getInscritosLocal } from "@/lib/tardeos";
import CalendarioLocal from "@/components/CalendarioLocal";
import { formatFecha, flyerSrc } from "@/lib/mockData";
import { Tardeo } from "@/lib/types";
import {
  Plus, Users, CreditCard, Pencil, BadgeCheck, Sparkles, Store, Loader2, Eye, TrendingUp,
} from "lucide-react";
import EstadisticasLocal from "@/components/EstadisticasLocal";
import ConsumoDelMes from "@/components/ConsumoDelMes";
import { planesActivos } from "@/lib/ajustes";
import { ETIQUETA, precioTexto, alCorriente, type Plan } from "@/lib/planes";

export default function PanelLocal() {
  const { user, loading } = useAuth();
  const [local, setLocal] = useState<any | null>(null);
  const [misTardeos, setMisTardeos] = useState<Tardeo[]>([]);
  const [metricas, setMetricas] = useState<{ visitas: number; inscritos: number }>({ visitas: 0, inscritos: 0 });
  const [inscritos, setInscritos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [reglas, setReglas] = useState(false);

  useEffect(() => {
    if (!user) { setCargando(false); return; }
    (async () => {
      const l = await getMiLocal(user.id);
      setLocal(l);
      if (l) {
        setMisTardeos(await getTardeosDeLocal(l.id));
        setMetricas(await getMetricasLocal(l.id));
        setInscritos(await getInscritosLocal(l.id));
        setReglas(await planesActivos());
      }
      setCargando(false);
    })();
  }, [user]);

  if (loading || cargando) {
    return (
      <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50">
        <Loader2 className="animate-spin" /> Cargando…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-bold text-tinta/70">Entra para acceder a tu panel.</p>
        <Link href="/perfil" className="mt-4 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Entrar</Link>
      </main>
    );
  }

  if (!local) {
    return (
      <main className="pb-8">
        <PanelHeader titulo="Panel del local" volverHref="/perfil" />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-marca text-white"><Store size={40} /></span>
          <h2 className="font-display text-2xl font-black">Aún no tienes local</h2>
          <p className="font-semibold text-tinta/70">Crea tu local (con su dirección) y empieza a publicar tardeos.</p>
          <Link href="/unirse?rol=local" className="rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Crear mi local</Link>
        </div>
      </main>
    );
  }

  // El contador viejo se queda de momento: es acumulado de siempre y sirve de
  // total histórico. Lo que dice cómo va el negocio es el bloque de abajo, que
  // tiene fechas.
  const stats = [
    { icon: Eye, label: "Visitas totales", valor: String(metricas.visitas) },
    { icon: Users, label: "Inscritos", valor: String(metricas.inscritos) },
    { icon: TrendingUp, label: "Tardeos", valor: String(misTardeos.length) },
  ];

  return (
    <main className="pb-8">
      <PanelHeader titulo="Panel del local" volverHref="/perfil">
        {local.verificado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-oro/20 px-3 py-1 text-xs font-black text-oro-600"><BadgeCheck size={14} /> Verificado</span>
        ) : (
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-black text-tinta/50">Pendiente</span>
        )}
      </PanelHeader>

      <div className="mx-auto max-w-5xl px-4 pt-5 md:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-marca p-6 text-white shadow-tarjeta md:p-8">
          <span className="bokeh" style={{ width: 120, height: 120, top: -20, right: 30, background: "#ffd36b", opacity: 0.4 }} />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20"><Store size={30} /></span>
              <div>
                <p className="font-script text-xl text-oro-400">¡Hola de nuevo!</p>
                <h2 className="font-display text-2xl font-black leading-tight md:text-3xl">{local.nombre}</h2>
                <Link href="/local/editar" className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold text-white/80 underline underline-offset-2 hover:text-white">
                  <Pencil size={13} /> Editar datos del local
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/local/crear" className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-lg font-extrabold text-magenta shadow-lg transition hover:brightness-105 active:scale-[0.98]">
                <Plus size={22} /> Crear tardeo
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-3">
          {stats.map(({ icon: Icon, label, valor }) => (
            <div key={label} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
              <Icon size={22} className="text-magenta" />
              <p className="mt-2 font-display text-2xl font-black leading-none md:text-3xl">{valor}</p>
              <p className="mt-1 text-xs font-bold text-tinta/60">{label}</p>
            </div>
          ))}
        </section>

        <ConsumoDelMes localId={local.id} plan={local.plan} reglasActivas={reglas} />

        <EstadisticasLocal localId={local.id} />

        {/* El calendario va ANTES de la lista: con quince tardeos al mes, la
            lista no deja ver qué findes están cubiertos y cuáles no, que es lo
            que hace falta para decidir qué programar. */}
        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-black md:text-2xl">Mi mes</h2>
            <Link href="/local/crear" className="text-sm font-extrabold text-magenta">+ Nuevo</Link>
          </div>
          <CalendarioLocal tardeos={misTardeos} />
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-black md:text-2xl">Mis tardeos</h2>
            <Link href="/local/crear" className="text-sm font-extrabold text-magenta">+ Nuevo</Link>
          </div>
          {misTardeos.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">Aún no has creado tardeos. ¡Crea el primero!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {misTardeos.map((t) => {
                const pub = t.estado === "publicado";
                /**
                 * Un programado enseña CUÁNDO sale, no solo que no está
                 * publicado. Sin la hora, el local ve "no publicado" en algo
                 * que sí va a salir y le entra la duda de si lo hizo bien.
                 */
                const programado = t.estado === "programado";
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-tarjeta ring-1 ring-black/5">
                    <Link href={`/tardeos/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      {/* Miniatura de 56 px: antes se bajaba el flyer entero. */}
                      <Image src={flyerSrc(t)} alt="" width={56} height={70} className="h-[70px] w-14 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0">
                        <p className="font-script text-base leading-none text-magenta-600">{formatFecha(t.fecha)}</p>
                        <h3 className="truncate font-display text-lg font-black leading-tight">{t.titulo}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${
                          pub ? "bg-oro/15 text-oro-600" : programado ? "bg-magenta-50 text-magenta-700" : "bg-black/5 text-tinta/50"
                        }`}>
                          {pub ? "Publicado"
                            : programado ? `Sale ${t.publicarEn ? new Date(t.publicarEn).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "pronto"}`
                            : t.estado === "borrador" ? "Oculto" : t.estado}
                        </span>
                      </div>
                    </Link>
                    <Link href={`/local/tardeos/${t.id}/editar`} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-magenta-50 px-3 py-2 text-sm font-extrabold text-magenta transition hover:bg-magenta-100">
                      <Pencil size={15} /> Editar
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {inscritos.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-black md:text-2xl">
              <Users size={22} className="text-magenta" /> Quién se ha apuntado
            </h2>
            <div className="flex flex-col gap-3">
              {Object.entries(
                inscritos.reduce((acc: Record<string, string[]>, r: any) => {
                  (acc[r.tardeo_titulo] ??= []).push(r.nombre);
                  return acc;
                }, {})
              ).map(([titulo, nombres]) => (
                <div key={titulo} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                  <p className="font-black leading-tight">
                    {titulo} <span className="font-bold text-tinta/50">· {nombres.length} apuntad{nombres.length === 1 ? "o" : "os"}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nombres.map((n, i) => (
                      <span key={i} className="rounded-full bg-magenta-50 px-3 py-1 text-sm font-bold text-magenta-700">{n}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-7 grid gap-3 md:grid-cols-2">
          <PromocionModal />
          {/*
            La suscripción de verdad, y solo cuando hay suscripciones.

            Aquí ponía "Plan Fundador · activa" ESCRITO A PELO, igual para
            todos, cuando ninguno de los 69 locales paga nada. Y con una flecha
            de "pulsa aquí" en un div que no lleva a ningún sitio. Un panel que
            le dice a un local que tiene el plan más caro contratado es peor que
            no tener panel.

            Mientras las reglas están apagadas no se enseña: no hay ninguna
            suscripción de la que informar, y un "sin plan" tampoco aporta nada
            cuando nadie puede contratarlo todavía.
          */}
          {reglas && (
            <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-tarjeta ring-1 ring-black/5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-oro/20 text-oro-600"><CreditCard size={24} /></span>
              <div className="flex-1">
                <p className="text-lg font-black leading-tight">Tu suscripción</p>
                <p className="text-sm font-semibold text-tinta/60">
                  Plan {ETIQUETA[(local.plan ?? "basic") as Plan]}
                  {alCorriente(local.plan_estado)
                    ? " · al corriente"
                    : local.plan_estado === "impago"
                      ? " · pago pendiente"
                      : " · sin activar"}
                </p>
                {/* Cuánto y CADA CUÁNTO. Un importe sin periodo no dice lo que
                    cuesta: el Fundador se cobra cada dos meses y el resto
                    cada uno, y por el número suelto parecían lo mismo. */}
                <p className="text-sm font-black text-tinta/80">
                  {precioTexto((local.plan ?? "basic") as Plan)}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-7 flex items-center gap-3 rounded-2xl bg-tinta p-5 text-white">
          <Sparkles size={26} className="shrink-0 text-oro" />
          <p className="text-sm font-semibold md:text-base"><span className="font-black">La IA trabaja por ti:</span> sube un flyer y creamos el tardeo solo.</p>
          <Link href="/local/crear" className="ml-auto shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-tinta">Probar</Link>
        </section>

        <GestionFotosLocal localId={local.id} iniciales={Array.isArray(local.fotos) ? local.fotos : []} />

        <ServiciosExternos tipo="local" />
      </div>
    </main>
  );
}
