"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import {
  CalendarDays, Store, Disc3, Euro, BadgeCheck, X, Check, Bot,
  Megaphone, Bell, BellRing, ShieldAlert, ChevronRight, Loader2, Star,
  Plus, CreditCard, ShieldCheck, Sparkles, Mail,
} from "lucide-react";

const AGENTES_INICIAL = [
  { id: "a1", tipo: "Crear ficha de local", detalle: "Chill Terrace · Sitges (datos públicos)" },
  { id: "a2", tipo: "Importar tardeo", detalle: "Remember Fest · Sala Blau · 09 ago" },
  { id: "a3", tipo: "Invitar", detalle: "DJ Rules → reclamar su perfil" },
];

const GESTION = [
  { icon: Plus, label: "Crear / invitar", sub: "Local, tardeo o invitación", href: "/admin/crear" },
  { icon: Megaphone, label: "Promociones y precios", sub: "Destacados · packs · combos", href: "/admin/promociones" },
  { icon: Mail, label: "Ofertas a locales", sub: "Enviar ofertas por email", href: "/admin/ofertas" },
  { icon: Bell, label: "Popups", sub: "Ofertas y noticias", href: "/admin/popups" },
  { icon: BellRing, label: "Notificaciones push", sub: "Aviso al móvil de los suscritos", href: "/admin/notificaciones" },
  { icon: Star, label: "Destacados", sub: "Quién sale primero en la home", href: "/admin/destacados" },
  { icon: ShieldCheck, label: "Moderación", sub: "Reseñas y flyers", href: "/admin/moderacion" },
  { icon: CreditCard, label: "Suscripciones", sub: "Pagos e impagos", href: "/admin/suscripciones" },
  { icon: Store, label: "Locales", sub: "Gestión de locales", href: "/admin/locales" },
  { icon: Disc3, label: "DJs", sub: "Gestión de DJs", href: "/admin/djs" },
];

export default function PanelAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [metricas, setMetricas] = useState({ tardeos: 0, locales: 0, djs: 0 });
  const [verif, setVerif] = useState<any[]>([]);
  const [agentes, setAgentes] = useState(AGENTES_INICIAL);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setCargando(false); return; }
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle().then(async ({ data }) => {
      const admin = !!data?.is_admin;
      setIsAdmin(admin);
      if (!admin) { setCargando(false); return; }
      const [t, l, d, pend] = await Promise.all([
        supabase.from("tardeos").select("*", { count: "exact", head: true }).eq("estado", "publicado"),
        supabase.from("locales").select("*", { count: "exact", head: true }).eq("estado", "activo"),
        supabase.from("djs").select("*", { count: "exact", head: true }),
        supabase.from("locales").select("*").neq("estado", "activo").order("created_at", { ascending: false }),
      ]);
      setMetricas({ tardeos: t.count ?? 0, locales: l.count ?? 0, djs: d.count ?? 0 });
      setVerif(pend.data ?? []);
      setCargando(false);
    });
  }, [user]);

  const aprobar = async (id: string) => {
    await supabase.from("locales").update({ estado: "activo", verificado: true }).eq("id", id);
    setVerif((p) => p.filter((x) => x.id !== id));
    setMetricas((m) => ({ ...m, locales: m.locales + 1 }));
  };
  const rechazar = async (id: string) => {
    await supabase.from("locales").delete().eq("id", id);
    setVerif((p) => p.filter((x) => x.id !== id));
  };

  if (loading || cargando) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</main>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <span className="mb-3 inline-grid h-16 w-16 place-items-center rounded-full bg-tinta text-white"><ShieldAlert size={32} /></span>
        <h2 className="font-display text-2xl font-black">Acceso restringido</h2>
        <p className="mt-1 font-semibold text-tinta/70">Esta zona es solo para administradores.</p>
        <Link href="/" className="mt-4 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Volver al inicio</Link>
      </main>
    );
  }

  const METRICAS = [
    { icon: CalendarDays, label: "Tardeos activos", valor: String(metricas.tardeos) },
    { icon: Store, label: "Locales", valor: String(metricas.locales) },
    { icon: Disc3, label: "DJs", valor: String(metricas.djs) },
    { icon: Euro, label: "Ingresos/mes", valor: "—" },
  ];

  return (
    <main className="pb-10">
      <PanelHeader titulo="Administración" volverHref="/perfil">
        <span className="inline-flex items-center gap-1 rounded-full bg-tinta px-3 py-1 text-xs font-black text-white">
          <ShieldAlert size={14} /> Admin
        </span>
      </PanelHeader>

      <div className="mx-auto max-w-5xl px-4 pt-5 md:px-8">
        {/* Métricas reales */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {METRICAS.map(({ icon: Icon, label, valor }) => (
            <div key={label} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
              <Icon size={22} className="text-magenta" />
              <p className="mt-2 font-display text-2xl font-black leading-none md:text-3xl">{valor}</p>
              <p className="mt-1 text-xs font-bold text-tinta/60">{label}</p>
            </div>
          ))}
        </section>

        {/* Agentes IA (demo) */}
        <section className="mt-5 flex items-center gap-3 rounded-2xl bg-tinta p-4 text-white">
          <Bot size={26} className="shrink-0 text-oro" />
          <p className="flex-1 text-sm font-semibold md:text-base">
            <span className="font-black">Agentes IA.</span> Prepararon {agentes.length} borradores. Nada se publica sin tu OK.
          </p>
        </section>

        <h2 className="mb-3 mt-7 font-display text-xl font-black md:text-2xl">Requiere tu atención</h2>

        {/* Verificaciones REALES */}
        <div className="mb-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-black text-tinta/60">
            <BadgeCheck size={16} className="text-magenta" /> Locales por verificar ({verif.length})
          </p>
          <div className="flex flex-col gap-3">
            {verif.map((v) => (
              <div key={v.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-black leading-tight">{v.nombre}</p>
                    <p className="truncate text-sm font-semibold text-tinta/60">{v.direccion || "Sin dirección"}</p>
                  </div>
                  {v.zona && <span className="shrink-0 rounded-full bg-magenta-50 px-2.5 py-1 text-xs font-black text-magenta-700">{v.zona}</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => aprobar(v.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-magenta py-3 text-sm font-extrabold text-white active:scale-[0.98]">
                    <Check size={18} /> Aprobar
                  </button>
                  <button onClick={() => rechazar(v.id)} className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-tinta/70 ring-1 ring-black/10 active:scale-[0.98]">
                    <X size={18} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
            {verif.length === 0 && (
              <p className="rounded-2xl bg-white p-4 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">Todo verificado ✅</p>
            )}
          </div>
        </div>

        {/* Borradores de agentes (demo) */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-black text-tinta/60">
            <Bot size={16} className="text-magenta" /> Borradores de agentes ({agentes.length})
          </p>
          <div className="flex flex-col gap-3">
            {agentes.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-oro/15 text-oro-600"><Sparkles size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-black leading-tight">{a.tipo}</p>
                  <p className="truncate text-sm font-semibold text-tinta/60">{a.detalle}</p>
                </div>
                <button onClick={() => setAgentes((p) => p.filter((x) => x.id !== a.id))} className="shrink-0 rounded-xl bg-magenta px-4 py-2.5 text-sm font-extrabold text-white active:scale-[0.98]">Publicar</button>
                <button onClick={() => setAgentes((p) => p.filter((x) => x.id !== a.id))} aria-label="Descartar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-tinta/50 ring-1 ring-black/10 active:scale-95"><X size={18} /></button>
              </div>
            ))}
            {agentes.length === 0 && <p className="rounded-2xl bg-white p-4 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">Sin borradores pendientes ✅</p>}
          </div>
        </div>

        {/* Gestión */}
        <h2 className="mb-3 mt-7 font-display text-xl font-black md:text-2xl">Gestión</h2>
        <section className="grid gap-3 sm:grid-cols-2">
          {GESTION.map(({ icon: Icon, label, sub, href }) => (
            <Link key={label} href={href} className="flex items-center gap-4 rounded-2xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><Icon size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black leading-tight">{label}</span>
                <span className="text-sm font-semibold text-tinta/60">{sub}</span>
              </span>
              <ChevronRight size={20} className="text-tinta/30" />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
