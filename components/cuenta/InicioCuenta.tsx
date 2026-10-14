"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getAdn, tieneAdn } from "@/lib/tardicola";
import { hoyISO } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import { claseBoton } from "@/components/Boton";
import { Etiqueta } from "@/components/ui/Chip";
import { MarcoCuenta, type DatosCuenta } from "@/components/panel/CuentaNav";
import {
  ArrowRight, Bell, Check, Disc3, Heart, Loader2, MapPin, Megaphone, ShieldCheck, Sparkles, Store, Ticket,
} from "lucide-react";

/**
 * Inicio de "Mi cuenta" del tardícola. El cliente decía que no entendía
 * cómo funcionaba la cuenta: aquí solo hay tres cosas, en este orden:
 *
 *  1. "Empieza aquí": tres pasos con su estado REAL (hecho / pendiente).
 *  2. Tus próximos planes: los tres siguientes, diciendo si te has apuntado
 *     o solo lo tienes guardado.
 *  3. Tus paneles (local, DJ, admin) o la invitación a crearlos.
 *
 * La contraseña, el email y cerrar sesión están en Ajustes.
 */

type TardeoMini = {
  id: string; titulo: string; fecha: string; hora_inicio: string | null; zona: string | null; estado: string | null;
  locales: { nombre: string | null } | null;
};
type Plan = { tardeo: TardeoMini; tipo: "apuntado" | "guardado" };

const CAMPOS = "id,titulo,fecha,hora_inicio,zona,estado,locales(nombre)";

/**
 * ¿Tiene los avisos puestos en este dispositivo? Solo se puede saber aquí: la
 * tabla de suscripciones no se deja leer desde el navegador (lote 18), a
 * propósito. Es lo que importa, además: el aviso llega al móvil que lo activó.
 */
async function avisosActivos(): Promise<boolean> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  if (Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

export default function InicioCuenta({ datos, email, uid }: { datos: DatosCuenta | null; email: string; uid: string }) {
  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const [errorPlanes, setErrorPlanes] = useState("");
  const [gustos, setGustos] = useState<boolean | null>(null);
  const [avisos, setAvisos] = useState<boolean | null>(null);
  const [nFav, setNFav] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    const hoy = hoyISO();
    // Apuntados y guardados de hoy en adelante. `!inner` para filtrar por la
    // fecha del tardeo; se ordena aquí porque no se puede ordenar la tabla
    // de fuera por un campo de la de dentro.
    Promise.all([
      supabase.from("inscripciones").select(`tardeo:tardeos!inner(${CAMPOS})`)
        .eq("profile_id", uid).eq("estado", "apuntado").gte("tardeo.fecha", hoy).limit(50),
      supabase.from("favoritos").select(`tardeo:tardeos!inner(${CAMPOS})`)
        .eq("profile_id", uid).gte("tardeo.fecha", hoy).limit(50),
    ]).then(([ins, fav]) => {
      if (!vivo) return;
      if (ins.error || fav.error) { setErrorPlanes("No pudimos cargar tus próximos planes. Recarga la página."); setPlanes([]); return; }
      const mapa = new Map<string, Plan>();
      // Si lo tienes guardado Y te has apuntado, manda "apuntado".
      for (const f of (fav.data ?? []) as unknown as { tardeo: TardeoMini }[]) if (f.tardeo) mapa.set(f.tardeo.id, { tardeo: f.tardeo, tipo: "guardado" });
      for (const f of (ins.data ?? []) as unknown as { tardeo: TardeoMini }[]) if (f.tardeo) mapa.set(f.tardeo.id, { tardeo: f.tardeo, tipo: "apuntado" });
      const orden = (p: Plan) => `${p.tardeo.fecha} ${p.tardeo.hora_inicio ?? "99"}`;
      setPlanes([...mapa.values()].sort((a, b) => orden(a).localeCompare(orden(b))).slice(0, 3));
    });
    supabase.from("favoritos").select("tardeo_id", { count: "exact", head: true }).eq("profile_id", uid)
      .then(({ count, error }) => { if (vivo) setNFav(error ? 0 : count ?? 0); });
    getAdn(uid).then((a) => { if (vivo) setGustos(tieneAdn(a)); });
    avisosActivos().then((v) => { if (vivo) setAvisos(v); }).catch(() => { if (vivo) setAvisos(false); });
    return () => { vivo = false; };
  }, [uid]);

  const nombre = datos?.nombre || email.split("@")[0];
  const conPlan = datos && nFav !== null ? datos.nInscripciones > 0 || nFav > 0 : null;

  const pasos: { hecho: boolean | null; titulo: string; texto: string; hecho_texto: string; href: string; boton: string; icono: typeof Heart }[] = [
    {
      hecho: gustos, icono: Sparkles, href: "/perfil/gustos",
      titulo: "Dinos qué te gusta", boton: gustos ? "Revisar" : "Elegir mis gustos",
      texto: "Música, ambiente y zona. Con eso te proponemos tardeos a tu medida.",
      hecho_texto: "Hecho. Te proponemos planes según tus gustos.",
    },
    {
      hecho: avisos, icono: Bell, href: "/perfil/notificaciones",
      titulo: "Activa los avisos", boton: avisos ? "Ver avisos" : "Activar avisos",
      texto: "Te avisamos en este móvil de los tardeos que te van y de los que te apuntas.",
      hecho_texto: "Hecho. Te llegarán los avisos a este dispositivo.",
    },
    {
      hecho: conPlan, icono: Heart, href: conPlan ? "/favoritos" : "/tardeos",
      titulo: "Guarda o apúntate a tu primer tardeo", boton: conPlan ? "Ver mis planes" : "Buscar tardeos",
      texto: "Toca el corazón para guardarlo, o «Apuntarme» para reservar plaza.",
      hecho_texto: "Hecho. Lo tienes en Mis planes.",
    },
  ];
  const hechos = pasos.filter((p) => p.hecho).length;
  const cargandoPasos = pasos.some((p) => p.hecho === null);

  const paneles = [
    datos?.ficha && { href: "/local", icono: datos.ficha.tipo === "promotor" ? Megaphone : Store, titulo: datos.ficha.tipo === "promotor" ? "Mis eventos" : "Mi local", texto: datos.ficha.nombre },
    datos?.esDj && { href: "/dj", icono: Disc3, titulo: "Mi perfil DJ", texto: "Perfil, sesiones y press kit" },
    datos?.esAdmin && { href: "/admin", icono: ShieldCheck, titulo: "Administración", texto: "Gestión de TardeosClub" },
  ].filter(Boolean) as { href: string; icono: typeof Store; titulo: string; texto: string }[];

  return (
    <MarcoCuenta titulo={`Hola, ${nombre}`} descripcion="Esta es tu cuenta de Tardícola: tus planes, tus gustos y tus avisos." datos={datos}>
      {/* 1. Empieza aquí. Cuando están los tres hechos, se reduce a una línea. */}
      <section aria-labelledby="empieza" className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="empieza" className="text-xl font-bold">{hechos === 3 ? "¡Tu cuenta está lista!" : "Empieza aquí"}</h2>
          {!cargandoPasos && <p className="text-[15px] font-semibold text-tinta-suave">{hechos} de 3 hechos</p>}
        </div>
        {!cargandoPasos && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-marfil-200" aria-hidden>
            <div className="h-full rounded-full bg-magenta transition-all" style={{ width: `${(hechos / 3) * 100}%` }} />
          </div>
        )}
        <ol className="mt-4 flex flex-col gap-3">
          {pasos.map((p, n) => (
            <li key={p.titulo} className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${p.hecho ? "border-ok/30 bg-ok-fondo/60" : "border-linea"}`}>
              <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[17px] font-bold ${p.hecho ? "bg-ok text-white" : "bg-magenta-50 text-magenta-700"}`}>
                {p.hecho === null ? <Loader2 size={18} className="animate-spin" /> : p.hecho ? <Check size={20} strokeWidth={3} /> : n + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold leading-snug">
                  {p.titulo}
                  <span className="sr-only">{p.hecho ? " (hecho)" : " (pendiente)"}</span>
                </p>
                <p className="text-[15px] text-tinta-suave">{p.hecho ? p.hecho_texto : p.texto}</p>
              </div>
              <Link href={p.href} className={claseBoton(p.hecho ? "contorno" : "primario", "pequeno", false, "shrink-0")}>
                {p.boton} <ArrowRight size={17} aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 2. Próximos planes: apuntados y guardados, juntos y diciendo cuál es cuál. */}
      <section aria-labelledby="proximos" className="mt-6 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="proximos" className="text-xl font-bold">Tus próximos planes</h2>
          <Link href="/favoritos" className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-[15px] font-bold text-magenta-700 hover:bg-magenta-50">
            Ver todos en Mis planes <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
        {planes === null ? (
          <p className="mt-3 flex items-center gap-2 text-tinta-suave"><Loader2 size={18} className="animate-spin" aria-hidden /> Cargando…</p>
        ) : errorPlanes ? (
          <p role="alert" className="mt-3 rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{errorPlanes}</p>
        ) : planes.length === 0 ? (
          <div className="mt-2">
            <p className="text-[16px] text-tinta-suave">No tienes ningún tardeo próximo, ni apuntado ni guardado.</p>
            <Link href="/tardeos" className={claseBoton("primario", "pequeno", false, "mt-3")}>Buscar tardeos</Link>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-linea">
            {planes.map(({ tardeo: t, tipo }) => (
              <li key={t.id}>
                <Link href={`/tardeos/${t.id}`} className="group flex min-h-[72px] items-center gap-3 py-3">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tipo === "apuntado" ? "bg-magenta text-white" : "bg-magenta-50 text-magenta"}`}>
                    {tipo === "apuntado" ? <Ticket size={22} aria-hidden /> : <Heart size={22} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Etiqueta tono={tipo === "apuntado" ? "ok" : "neutro"}>{tipo === "apuntado" ? "Te has apuntado" : "Guardado"}</Etiqueta>
                      {t.estado === "cancelado" && <Etiqueta tono="error">Cancelado por el organizador</Etiqueta>}
                    </span>
                    <span className="mt-1 block truncate text-[16px] font-bold group-hover:text-magenta-700">{t.titulo}</span>
                    <span className="block truncate text-[14px] text-tinta-suave">
                      {formatFecha(t.fecha)}{t.hora_inicio ? ` · ${t.hora_inicio.slice(0, 5)}` : ""}
                      {(t.locales?.nombre || t.zona) && <> · <MapPin size={13} className="inline align-[-2px]" aria-hidden /> {t.locales?.nombre || t.zona}</>}
                    </span>
                  </span>
                  <ArrowRight size={18} className="shrink-0 text-tinta-suave" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {planes && planes.some((p) => p.tipo === "guardado") && (
          <p className="mt-2 text-[14px] text-tinta-suave">«Guardado» no reserva plaza: entra en el tardeo y pulsa «Apuntarme» si vas a ir.</p>
        )}
      </section>

      {/* 3. Paneles de trabajo, o la invitación a crearlos. */}
      <section aria-labelledby="paneles" className="mt-6">
        {paneles.length > 0 ? (
          <>
            <h2 id="paneles" className="mb-3 text-xl font-bold">Mis paneles</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {paneles.map((p) => (
                <Link key={p.href} href={p.href} className="group flex min-h-[80px] items-center gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta transition hover:shadow-elevada">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-magenta text-white"><p.icono size={21} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{p.titulo}</span>
                    <span className="block truncate text-[14px] text-tinta-suave">{p.texto}</span>
                  </span>
                  <ArrowRight size={18} className="shrink-0 text-tinta-suave transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
            <h2 id="paneles" className="text-xl font-bold">¿Tienes un local o eres DJ?</h2>
            <p className="text-[16px] text-tinta-suave">Crea tu ficha con esta misma cuenta y publica tus tardeos o tus sesiones. Tu cuenta de Tardícola sigue igual.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/unirse?rol=local" className={claseBoton("contorno", "pequeno")}><Store size={18} aria-hidden /> Tengo un local o hago eventos</Link>
              <Link href="/unirse?rol=dj" className={claseBoton("contorno", "pequeno")}><Disc3 size={18} aria-hidden /> Soy DJ</Link>
            </div>
          </div>
        )}
      </section>
    </MarcoCuenta>
  );
}
