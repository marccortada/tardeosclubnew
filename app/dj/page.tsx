"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BadgeCheck, EyeOff, ExternalLink, ChevronRight, Circle, Share2, Check, MessageCircle,
} from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Etiqueta } from "@/components/ui/Chip";
import Aviso from "@/components/admin/Aviso";
import { claseBoton } from "@/components/Boton";
import { whatsappTardeos } from "@/components/ServiciosExternos";
import { supabase } from "@/lib/supabase";
import { hoyISO } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import { tieneValoracion, valoracion } from "@/lib/reputacion";
import { useDj, consultaTardeosDj, type TardeoDj } from "./contexto";

/**
 * Inicio del panel DJ, corto: quién eres y cómo se te ve, las dos acciones
 * (compartir la ficha, verla), dónde pinchas pronto, lo que le FALTA a tu
 * ficha (solo lo pendiente; si está completa no sale) y tres cifras.
 *
 * Antes eran cinco cifras, la lista entera de pasos con los hechos tachados,
 * textos de ayuda y los servicios de pago (ahora en Ayuda): en el móvil no se
 * llegaba a ver dónde pinchabas sin bajar varias pantallas.
 */
export default function ResumenDj() {
  const { dj, ruta, modoAdmin } = useDj();
  const [proximos, setProximos] = useState<TardeoDj[] | null>(null);
  const [nProximos, setNProximos] = useState<number | null>(null);
  // null = cargando; "—" si no se pudo leer (no es lo mismo que no tener nada).
  const [nContenido, setNContenido] = useState<number | string | null>(null);
  // null = cargando; "—" si no se pudo leer (p. ej. falta el lote 34).
  const [visitas, setVisitas] = useState<number | string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    consultaTardeosDj(dj.id)
      .gte("fecha", hoyISO())
      .order("fecha", { ascending: true })
      .range(0, 4)
      .then(({ data, count, error: e }) => {
        if (!vivo) return;
        if (e) { setError("No se pudieron cargar tus próximos tardeos."); setProximos([]); return; }
        setProximos((data as unknown as TardeoDj[]) ?? []);
        setNProximos(count ?? 0);
      });
    supabase.from("dj_contenidos").select("id", { count: "exact", head: true }).eq("dj_id", dj.id)
      .then(({ count, error: e }) => { if (vivo) setNContenido(e ? "—" : count ?? 0); });
    // Visitas a la ficha en 30 días: solo el recuento (head), sin traer filas.
    // La RLS de eventos_metrica deja al DJ leer las suyas y al admin todas.
    const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    supabase.from("eventos_metrica").select("id", { count: "exact", head: true })
      .eq("dj_id", dj.id).eq("tipo", "vista_dj").gte("created_at", hace30)
      .then(({ count, error: e }) => { if (vivo) setVisitas(e ? "—" : count ?? 0); });
    return () => { vivo = false; };
  }, [dj.id]);

  const redes = dj.redes ?? {};
  const estilos = Array.isArray(dj.estilos) ? dj.estilos : [];
  const inicial = (String(dj.nombre_artistico || "DJ").replace(/^DJ /i, "").match(/\p{L}|\p{N}/u)?.[0] ?? "D").toUpperCase();

  // Lo que hace que una ficha "venda": cada punto lleva a donde se arregla.
  const pasos = [
    { ok: !!dj.avatar_url, texto: "Pon una foto tuya", href: ruta("/dj/perfil") },
    { ok: !!dj.bio?.trim(), texto: "Escribe tu biografía", href: ruta("/dj/perfil") },
    { ok: estilos.length > 0, texto: "Elige tus estilos de música", href: ruta("/dj/perfil") },
    { ok: !!(redes.instagram || redes.soundcloud || redes.youtube || redes.whatsapp), texto: "Añade tus redes o un contacto", href: ruta("/dj/perfil") },
    { ok: !!dj.playlist_url, texto: "Pega tu playlist", href: ruta("/dj/perfil") },
    { ok: typeof nContenido === "number" && nContenido > 0, texto: "Sube una sesión, un vídeo o fotos", href: ruta("/dj/contenido") },
    { ok: !!dj.presskit_url, texto: "Sube tu PressKit en PDF", href: ruta("/dj/presskit") },
  ];
  const hechos = pasos.filter((p) => p.ok).length;
  const pct = Math.round((hechos / pasos.length) * 100);
  // Mientras se cuenta el contenido no se sabe si falta: no se enseña aún.
  const faltan = nContenido === null ? [] : pasos.filter((p) => !p.ok);

  return (
    <SeccionPanel titulo="Inicio">
      {modoAdmin && <Aviso tono="aviso">Estás viendo el panel de {dj.nombre_artistico} como administración. Lo que cambies se guarda en su ficha.</Aviso>}

      {/* Quién eres y las dos acciones */}
      <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
        <div className="flex items-center gap-4">
          {dj.avatar_url ? (
            <Image src={dj.avatar_url} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-linea" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-marfil-100 text-2xl font-bold text-tinta-suave" aria-hidden>{inicial}</span>
          )}
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-bold leading-tight md:text-2xl">
              <span className="truncate">{dj.nombre_artistico}</span>
              {dj.verificado && <BadgeCheck size={22} className="shrink-0 text-magenta" aria-label="Verificado" />}
            </h2>
            {/* Solo se avisa de lo que no va bien: «Visible» no aporta nada. */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {!dj.verificado && <Etiqueta tono="aviso">Sin verificar</Etiqueta>}
              {dj.oculto && <Etiqueta tono="neutro"><EyeOff size={14} aria-hidden /> Oculto al público</Etiqueta>}
            </div>
          </div>
        </div>
        {dj.oculto && (
          <p className="mt-4 rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta">
            Tu ficha está oculta: solo la ves tú. Si crees que es un error, escríbenos y lo revisamos.
          </p>
        )}
        {dj.oculto && !modoAdmin && (
          <a href={whatsappTardeos(`Hola, soy ${dj.nombre_artistico} (DJ) y mi ficha de TardeosClub aparece oculta. ¿Podéis revisarla?`)}
            target="_blank" rel="noopener noreferrer" className={claseBoton("contorno", "pequeno", true, "mt-2")}>
            <MessageCircle size={18} aria-hidden /> Escribir a TardeosClub
          </a>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <BotonCompartir nombre={dj.nombre_artistico} url={`/djs/${dj.id}`} />
          <Link href={`/djs/${dj.id}`} className={claseBoton("contorno", "pequeno", true)}>
            <ExternalLink size={18} aria-hidden /> Ver mi ficha
          </Link>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Próximos tardeos */}
        <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Dónde pinchas pronto</h2>
            {(nProximos ?? 0) > 0 && (
              <Link href={ruta("/dj/tardeos")} className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-magenta-700 hover:underline">Ver todos</Link>
            )}
          </div>
          {error && <p className="mt-3 rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
          {proximos === null ? (
            <div className="mt-3 flex flex-col gap-2" aria-busy>
              {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-marfil-100" />)}
            </div>
          ) : proximos.length === 0 && !error ? (
            <p className="mt-3 text-[15px] text-tinta-suave">
              Aún nada. Los locales te añaden al publicar un tardeo: comparte tu ficha para que te encuentren.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-linea">
              {proximos.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <Link href={`/tardeos/${t.id}`} className="flex min-h-[56px] items-center gap-3 py-2 hover:text-magenta-700">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{t.titulo}</span>
                      <span className="block truncate text-sm text-tinta-suave">
                        {formatFecha(t.fecha)}{t.hora_inicio ? ` · ${t.hora_inicio.slice(0, 5)}` : ""}{t.locales?.nombre ? ` · ${t.locales.nombre}` : ""}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-tinta-suave" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Lo que le falta a la ficha: solo lo pendiente, y nada si está completa. */}
        {faltan.length > 0 && (
          <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold">Completa tu ficha</h2>
              <span className="text-sm font-semibold text-tinta-suave">{pct} %</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-marfil-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Perfil completado">
              <div className="h-full rounded-full bg-magenta transition-all" style={{ width: `${pct}%` }} />
            </div>
            <ul className="mt-2 flex flex-col">
              {faltan.map((p) => (
                <li key={p.texto}>
                  <Link href={p.href} className="flex min-h-[44px] items-center gap-3 rounded-lg text-[15px] font-semibold text-tinta hover:text-magenta-700">
                    <Circle size={20} className="shrink-0 text-linea-fuerte" aria-hidden />
                    <span className="flex-1">{p.texto}</span>
                    <ChevronRight size={18} className="text-tinta-suave" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Tres cifras, sin explicaciones: el detalle está en cada sección. */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <Cifra valor={nProximos} texto="Próximos" href={ruta("/dj/tardeos")} />
        <Cifra valor={visitas} texto="Visitas (30 d)" />
        <Cifra valor={tieneValoracion(dj.reputacion_score) ? valoracion(dj.reputacion_score) : "—"} texto="Valoración" href={ruta("/dj/resenas")} />
      </div>
    </SeccionPanel>
  );
}

function Cifra({
  valor, texto, href,
}: { valor: number | string | null; texto: string; href?: string }) {
  const dentro = (
    <>
      <span className="block text-[26px] font-bold leading-none tabular-nums">{valor ?? "…"}</span>
      <span className="mt-1.5 block text-[14px] font-semibold text-tinta-suave">{texto}</span>
    </>
  );
  const cls = "block rounded-2xl border border-linea bg-white p-3 text-center shadow-tarjeta sm:p-4";
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-magenta/40`}>{dentro}</Link> : <div className={cls}>{dentro}</div>;
}

/**
 * Compartir la ficha pública: menú nativo del móvil (WhatsApp, Instagram…) o,
 * en escritorio, copiar el enlace. Con texto, que un icono suelto no se
 * entiende.
 */
function BotonCompartir({ nombre, url }: { nombre: string; url: string }) {
  const [hecho, setHecho] = useState<"" | "copiado" | "error">("");
  const compartir = async () => {
    const abs = window.location.origin + url;
    const texto = `Mira mi perfil de DJ en TardeosClub: ${nombre}`;
    if (navigator.share) {
      try { await navigator.share({ title: nombre, text: texto, url: abs }); } catch { /* canceló */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(abs);
      setHecho("copiado");
    } catch {
      setHecho("error");
    }
    setTimeout(() => setHecho(""), 2500);
  };
  return (
    <button type="button" onClick={compartir} className={claseBoton("contorno", "pequeno", true)} aria-live="polite">
      {hecho === "copiado" ? <><Check size={18} className="text-ok" aria-hidden /> Enlace copiado</>
        : hecho === "error" ? <>No se pudo copiar</>
        : <><Share2 size={18} aria-hidden /> Compartir</>}
    </button>
  );
}
