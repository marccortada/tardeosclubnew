"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { enlaceInstagram, enlaceWeb, enlaceTelefono } from "@/lib/crm";
import {
  CalendarDays, Store, Disc3, Euro, BadgeCheck, X, Check, Contact,
  Megaphone, Bell, BellRing, ShieldAlert, ChevronRight, Loader2, Star,
  Plus, CreditCard, ShieldCheck, Mail, CalendarPlus, LineChart, Phone, Instagram, Globe, Users, Stethoscope } from "lucide-react";

/**
 * El panel, por grupos y no en una lista de doce.
 *
 * Doce tarjetas seguidas se leen enteras cada vez, porque nada dice dónde mirar:
 * "Popups" y "Suscripciones" pesaban igual estando una al lado de la otra y sin
 * tener nada que ver. Agrupadas, se va directo al bloque.
 *
 * El criterio es POR TRABAJO, no por parecido de nombre. "Promociones y precios"
 * suena a marketing y no lo es: es el catálogo con el precio de lo que se vende
 * (destacados, packs, combos), así que va en Finanzas, al lado de los cobros.
 * Y "Destacados", que suena a lo mismo, es decidir quién sale primero en la
 * portada, que es marketing puro.
 *
 * Reclamaciones va en Control y no en Comercial aunque un local que reclama su
 * ficha sea una venta a medio hacer: lo que se hace ahí es comprobar que es
 * quien dice ser y darle acceso, y eso se parece a moderar, no a vender.
 */
/**
 * Lo primero de la pantalla, porque es lo que más se hace.
 *
 * Estaba enterrado como una tarjeta más ("Crear / invitar") entre otras once, y
 * encima detrás de un menú: tres toques para dar de alta un DJ. Aquí van los
 * cuatro directos, cada uno a su formulario.
 */
const CREAR = [
  { icon: CalendarPlus, label: "Tardeo", href: "/local/crear" },
  { icon: Store, label: "Local", href: "/admin/crear?tipo=local" },
  { icon: Megaphone, label: "Promotor", href: "/admin/crear?tipo=promotor" },
  { icon: Disc3, label: "DJ", href: "/admin/crear?tipo=dj" },
];

const GRUPOS = [
  {
    titulo: "Comercial",
    pie: "Vender a los locales",
    items: [
      { icon: Contact, label: "CRM comercial", sub: "A quién le toca hoy", href: "/admin/crm" },
      { icon: Mail, label: "Ofertas a locales", sub: "Enviar ofertas por email", href: "/admin/ofertas" },
    ],
  },
  {
    titulo: "Finanzas",
    pie: "Qué se cobra y quién paga",
    items: [
      { icon: CreditCard, label: "Suscripciones", sub: "Pagos e impagos", href: "/admin/suscripciones" },
      { icon: Megaphone, label: "Promociones y precios", sub: "Destacados · packs · combos", href: "/admin/promociones" },
    ],
  },
  {
    titulo: "Marketing",
    pie: "Qué ve la gente y cuándo",
    items: [
      { icon: LineChart, label: "Estadísticas", sub: "Qué hace la gente en la web", href: "/admin/estadisticas" },
      { icon: Star, label: "Destacados", sub: "Quién sale primero en la home", href: "/admin/destacados" },
      { icon: Bell, label: "Popups", sub: "Ofertas y noticias", href: "/admin/popups" },
      { icon: BellRing, label: "Notificaciones push", sub: "Aviso al móvil de los suscritos", href: "/admin/notificaciones" },
    ],
  },
  {
    titulo: "Control",
    pie: "Qué entra y qué se queda",
    items: [
      { icon: BadgeCheck, label: "Reclamaciones", sub: "Quién pide gestionar su ficha", href: "/admin/reclamaciones" },
      { icon: ShieldCheck, label: "Moderación", sub: "Reseñas y flyers", href: "/admin/moderacion" },
      { icon: Stethoscope, label: "Salud", sub: "Si algo está mal, aquí se ve", href: "/admin/salud" },
    ],
  },
  {
    titulo: "Fichas",
    pie: "Quién está dado de alta",
    items: [
      { icon: Users, label: "Colaboradores", sub: "Locales, promotores y DJs", href: "/admin/colaboradores" },
    ],
  },
];

export default function PanelAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [metricas, setMetricas] = useState({ tardeos: 0, pasados: 0, locales: 0, djs: 0 });
  const [verif, setVerif] = useState<any[]>([]);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setCargando(false); return; }
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle().then(async ({ data }) => {
      const admin = !!data?.is_admin;
      setIsAdmin(admin);
      if (!admin) { setCargando(false); return; }
      /**
       * "Activos" significa lo mismo que en la web: publicado y que aún no ha
       * pasado. Antes contaba los publicados SIN mirar la fecha, y por eso el
       * panel decía "26 tardeos activos" mientras el mapa y el listado estaban
       * vacíos: los 26 eran del 14 de julio al 30 de agosto, todos terminados.
       *
       * Un número que no cuadra con lo que se ve en la web no es un número: es
       * una pregunta. Y los pasados se enseñan aparte, que también es
       * información —y es justo la que explica el cero—.
       */
      const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
      const publicados = () =>
        supabase.from("tardeos").select("*", { count: "exact", head: true })
          .or(`estado.eq.publicado,and(estado.eq.programado,publicar_en.lte.${new Date().toISOString()})`);

      const [t, pas, l, d, pend] = await Promise.all([
        publicados().gte("fecha", hoy),
        publicados().lt("fecha", hoy),
        supabase.from("locales").select("*", { count: "exact", head: true }).eq("estado", "activo"),
        supabase.from("djs").select("*", { count: "exact", head: true }),
        supabase.from("locales").select("*").neq("estado", "activo").order("created_at", { ascending: false }),
      ]);
      setMetricas({ tardeos: t.count ?? 0, pasados: pas.count ?? 0, locales: l.count ?? 0, djs: d.count ?? 0 });

      /**
       * El email de quien lo registró, en una consulta aparte.
       *
       * Sin esto había que aprobar o BORRAR a ciegas: la tarjeta solo enseñaba
       * el nombre y la dirección. No se puede decidir sobre una ficha sin ver
       * quién la ha pedido ni por dónde escribirle.
       */
      const filas = pend.data ?? [];
      const ids = [...new Set(filas.map((x) => x.owner_id).filter(Boolean))] as string[];
      const correos = new Map<string, string>();
      if (ids.length) {
        const { data: perfiles } = await supabase.from("profiles").select("id,email").in("id", ids);
        (perfiles ?? []).forEach((p) => correos.set(p.id, p.email ?? ""));
      }
      setVerif(filas.map((x) => ({ ...x, duenoEmail: x.owner_id ? correos.get(x.owner_id) ?? null : null })));
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
    { icon: CalendarDays, label: "Tardeos activos", valor: String(metricas.tardeos),
      pie: metricas.pasados ? `${metricas.pasados} ya pasados` : undefined },
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
        <h2 className="mb-3 font-display text-xl font-black md:text-2xl">Crear</h2>
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CREAR.map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 rounded-2xl bg-marca p-4 text-white shadow-tarjeta transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
            >
              <Icon size={26} />
              <span className="font-display text-base font-black leading-none">{label}</span>
            </Link>
          ))}
        </section>

        {/* Métricas reales */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {METRICAS.map(({ icon: Icon, label, valor, pie }) => (
            <div key={label} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
              <Icon size={22} className="text-magenta" />
              <p className="mt-2 font-display text-2xl font-black leading-none md:text-3xl">{valor}</p>
              <p className="mt-1 text-xs font-bold text-tinta/60">{label}</p>
              {pie && <p className="text-xs font-semibold text-tinta/40">{pie}</p>}
            </div>
          ))}
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
                    <p className="font-display text-lg fontetc-black leading-tight">{v.nombre}</p>
                    <p className="truncate text-sm font-semibold text-tinta/60">{v.direccion || "Sin dirección"}</p>
                  </div>
                  {v.zona && <span className="shrink-0 rounded-full bg-magenta-50 px-2.5 py-1 text-xs font-black text-magenta-700">{v.zona}</span>}
                </div>

                {/* Con quién estás hablando y desde cuándo espera. */}
                <p className="mt-1 text-xs font-semibold text-tinta/45">
                  {v.tipo === "promotor" ? "Promotor" : "Local"}
                  {v.estado === "oculto_impago" ? " · oculto por impago" : ""}
                  {v.created_at ? ` · pedido el ${new Date(v.created_at).toLocaleDateString("es-ES")}` : ""}
                  {v.duenoEmail ? ` · lo registró ${v.duenoEmail}` : " · sin cuenta asociada"}
                </p>

                <ContactoLocal local={v} />

                <div className="mt-3 flex gap-2">
                  <button onClick={() => aprobar(v.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-magenta py-3 text-sm font-extrabold text-white active:scale-[0.98]">
                    <Check size={18} /> Aprobar
                  </button>
                  {/* Dos toques, porque esto BORRA la ficha para siempre. Antes
                      era un botón normal al lado de "Aprobar", del mismo tamaño
                      y sin avisar de nada. */}
                  <button
                    onClick={() => (porBorrar === v.id ? rechazar(v.id) : setPorBorrar(v.id))}
                    onBlur={() => setPorBorrar((p) => (p === v.id ? null : p))}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-extrabold active:scale-[0.98] ${
                      porBorrar === v.id
                        ? "bg-red-600 text-white"
                        : "bg-white text-tinta/70 ring-1 ring-black/10"}`}
                  >
                    <X size={18} /> {porBorrar === v.id ? "Sí, borrar" : "Rechazar"}
                  </button>
                </div>
                {porBorrar === v.id && (
                  <p className="mt-2 text-xs font-bold text-red-700">
                    Se borra la ficha entera y no se puede deshacer. Si solo quieres que no se vea,
                    déjala sin aprobar.
                  </p>
                )}
              </div>
            ))}
            {verif.length === 0 && (
              <p className="rounded-2xl bg-white p-4 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">Todo verificado ✅</p>
            )}
          </div>
        </div>

        {/* Gestión.
            Se perdió entera al quitar la maqueta de agentes: el bloque de la
            maqueta terminaba justo aquí encima y el borrado se llevó también
            esto. Resultado: las diez pantallas de administración existían y
            ninguna se podía abrir desde el panel. */}
        {GRUPOS.map((g) => (
          <div key={g.titulo}>
            <h2 className="mb-1 mt-7 font-display text-xl font-black md:text-2xl">{g.titulo}</h2>
            {/* El pie del grupo dice de qué va, para que nadie tenga que abrir
                una pantalla para averiguar si es la que buscaba. */}
            <p className="mb-3 text-sm font-semibold text-tinta/50">{g.pie}</p>
            <section className="grid gap-3 sm:grid-cols-2">
              {g.items.map(({ icon: Icon, label, sub, href }) => (
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
        ))}
      </div>
    </main>
  );
}

/**
 * Por dónde escribir a un local que pide verificación.
 *
 * Los datos ya estaban en su ficha; lo que no había era manera de verlos antes
 * de decidir. Se enseña lo que haya y, si no hay nada, se dice: que un local no
 * haya dejado forma de contacto también es información para decidir.
 */
function ContactoLocal({ local }: { local: any }) {
  const redes = (local.redes ?? {}) as Record<string, string>;
  const canales = [
    local.email && { icono: Mail, url: `mailto:${local.email}`, texto: local.email },
    local.telefono && { icono: Phone, url: enlaceTelefono(local.telefono) ?? "#", texto: local.telefono },
    redes.instagram && { icono: Instagram, url: enlaceInstagram(redes.instagram) ?? "#", texto: "Instagram" },
    redes.web && { icono: Globe, url: enlaceWeb(redes.web) ?? "#", texto: "Web" },
  ].filter(Boolean) as { icono: typeof Mail; url: string; texto: string }[];

  if (canales.length === 0) {
    return <p className="mt-2 text-sm font-bold text-tinta/40">Sin forma de contacto en la ficha</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {canales.map((c) => (
        <a
          key={c.url} href={c.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1.5 text-xs font-black text-tinta/70 transition hover:bg-magenta hover:text-white"
        >
          <c.icono size={14} /> <span className="max-w-[13rem] truncate">{c.texto}</span>
        </a>
      ))}
    </div>
  );
}
