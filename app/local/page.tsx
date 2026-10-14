"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, ExternalLink, Share2, Eye, Users, CalendarDays, FileText, BadgeCheck, Check, ArrowRight,
} from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Etiqueta } from "@/components/ui/Chip";
import FichaPendiente from "@/components/FichaPendiente";
import { useFicha } from "./_panel/PanelLocal";
import FilaTardeo from "./_panel/FilaTardeo";
import {
  getMetricasLocal, contarTardeosDeLocal, getInscritosLocal, getTardeosDeLocal, hoyISO,
} from "@/lib/tardeos";
import type { Tardeo } from "@/lib/types";

type Datos = {
  visitas: number | null;
  apuntados: number | null;
  proximos: number | null;
  borradores: number | null;
  siguientes: Tardeo[];
  error: string | null;
  /** Visitas y apuntados que no se pudieron leer: se enseña «—» y el motivo. */
  errorCifras: string | null;
};

/**
 * Resumen del panel: lo que hay que saber al entrar y los tres atajos que más
 * se usan. El resto (lista entera, fotos, datos) tiene su sección.
 *
 * Todo se pide a la vez. Antes eran cuatro esperas en fila (local, tardeos,
 * métricas, apuntados) y el panel tardaba la suma de las cuatro en aparecer.
 */
export default function ResumenLocal() {
  const { ficha, enlace, esPromotor } = useFicha();
  const [d, setD] = useState<Datos | null>(null);
  const [compartido, setCompartido] = useState<"" | "copiado" | "error">("");

  useEffect(() => {
    let vivo = true;
    setD(null);
    const hoy = hoyISO();
    Promise.all([
      getMetricasLocal(ficha.id),
      contarTardeosDeLocal(ficha.id),
      getInscritosLocal(ficha.id),
      getTardeosDeLocal(ficha.id, "proximos", 0, 2),
    ]).then(([m, cuentas, inscritos, prox]) => {
      if (!vivo) return;
      setD({
        visitas: m.error ? null : m.visitas,
        // Los que vienen, no los de siempre: es la cifra que sirve para
        // preparar barra y personal este fin de semana.
        apuntados: inscritos.error ? null : inscritos.filas.filter((i) => i.fecha >= hoy).length,
        errorCifras: m.error ?? inscritos.error,
        proximos: cuentas.proximos,
        borradores: cuentas.borradores,
        siguientes: prox.data ?? [],
        error: prox.error?.message ?? null,
      });
    });
    return () => { vivo = false; };
  }, [ficha.id]);

  const publica = ficha.estado === "activo";
  const urlFicha = typeof window !== "undefined" ? `${window.location.origin}/locales/${ficha.id}` : `/locales/${ficha.id}`;

  const compartir = async () => {
    setCompartido("");
    try {
      if (navigator.share) {
        await navigator.share({ title: ficha.nombre, text: `${ficha.nombre} en TardeosClub`, url: urlFicha });
        return;
      }
      await navigator.clipboard.writeText(urlFicha);
      setCompartido("copiado");
    } catch (e) {
      // Cerrar el menú de compartir no es un fallo.
      if ((e as Error)?.name === "AbortError") return;
      setCompartido("error");
    }
  };

  const kpis = [
    { icon: Eye, label: "Visitas a tu ficha y tardeos", valor: d?.visitas, ayuda: "Desde siempre" },
    { icon: Users, label: "Apuntados", valor: d?.apuntados, ayuda: "A tus próximos tardeos", href: "/local/apuntados" },
    { icon: CalendarDays, label: "Tardeos próximos", valor: d?.proximos, ayuda: "Publicados o programados", href: "/local/tardeos" },
    { icon: FileText, label: "Borradores", valor: d?.borradores, ayuda: "Guardados sin publicar", href: "/local/tardeos?filtro=borradores" },
  ];

  return (
    <SeccionPanel
      titulo={ficha.nombre}
      descripcion={esPromotor ? "Resumen de tus eventos en TardeosClub." : "Resumen de tu local en TardeosClub."}
      acciones={
        ficha.verificado
          ? <Etiqueta tono="ok"><BadgeCheck size={14} aria-hidden /> Verificado</Etiqueta>
          : publica ? <Etiqueta tono="ok">Publicada</Etiqueta> : <Etiqueta tono="aviso">Sin publicar</Etiqueta>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Por qué no se ve la ficha. Va lo primero: si tu local no sale en
            la web, es lo único que te importa. */}
        <FichaPendiente estado={ficha.estado} local={ficha} hrefEditar={enlace("/local/editar")} />

        {d?.errorCifras && (
          <p role="alert" className="-mb-3 rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">
            Algunas cifras no se han podido cargar: {d.errorCifras}
          </p>
        )}
        <section aria-label="Cifras" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(({ icon: Icon, label, valor, ayuda, href }) => {
            const cuerpo = (
              <>
                <Icon size={20} className="text-magenta" aria-hidden />
                <p className="mt-2 text-[28px] font-bold leading-none">
                  {d ? (valor ?? "—") : <span className="inline-block h-7 w-10 animate-pulse rounded bg-marfil-100" />}
                </p>
                <p className="mt-1.5 text-[15px] font-semibold leading-tight">{label}</p>
                <p className="text-[13px] text-tinta-suave">{ayuda}</p>
              </>
            );
            return href ? (
              <Link key={label} href={enlace(href)} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta transition hover:border-linea-fuerte">
                {cuerpo}
              </Link>
            ) : (
              <div key={label} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">{cuerpo}</div>
            );
          })}
        </section>

        <section aria-label="Accesos rápidos" className="grid gap-3 md:grid-cols-3">
          <Link href={enlace("/local/crear")}
            className="flex min-h-[88px] items-center gap-4 rounded-2xl bg-magenta p-4 text-white shadow-tarjeta transition hover:bg-magenta-600">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15"><Sparkles size={24} aria-hidden /></span>
            <span>
              <span className="block text-[17px] font-bold leading-tight">Crear tardeo con IA</span>
              <span className="text-sm text-white/90">Sube el flyer y rellenamos los datos</span>
            </span>
          </Link>
          <Link href={`/locales/${ficha.id}`} target="_blank"
            className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta transition hover:border-linea-fuerte">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><ExternalLink size={22} aria-hidden /></span>
            <span>
              <span className="block text-[17px] font-bold leading-tight">Ver mi ficha pública</span>
              <span className="text-sm text-tinta-suave">{publica ? "Así te ve la gente" : "Aún no es visible para el público"}</span>
            </span>
          </Link>
          <button type="button" onClick={compartir} disabled={!publica}
            className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-linea bg-white p-4 text-left shadow-tarjeta transition hover:border-linea-fuerte disabled:cursor-not-allowed disabled:opacity-60">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
              {compartido === "copiado" ? <Check size={22} aria-hidden /> : <Share2 size={22} aria-hidden />}
            </span>
            <span>
              <span className="block text-[17px] font-bold leading-tight">Compartir ficha</span>
              <span className="text-sm text-tinta-suave" aria-live="polite">
                {!publica ? "Podrás cuando esté publicada"
                  : compartido === "copiado" ? "Enlace copiado. Pégalo donde quieras"
                  : compartido === "error" ? "No se pudo copiar. Inténtalo otra vez"
                  : "Por WhatsApp, Instagram o donde quieras"}
              </span>
            </span>
          </button>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 className="text-xl font-bold">Tus próximos tardeos</h2>
            <Link href={enlace("/local/tardeos")} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-magenta-700">
              Ver todos <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          {!d ? (
            <div className="flex flex-col gap-2" aria-busy>
              {[0, 1, 2].map((i) => <div key={i} className="h-[94px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
            </div>
          ) : d.error ? (
            <p className="rounded-xl border border-error/20 bg-error-fondo p-4 text-[15px] font-semibold text-error">No se pudieron cargar: {d.error}</p>
          ) : d.siguientes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center">
              <p className="text-[15px] text-tinta-suave">No tienes tardeos próximos publicados.</p>
              <Link href={enlace("/local/crear")} className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-magenta px-5 text-[16px] font-bold text-white hover:bg-magenta-600">
                <Sparkles size={18} aria-hidden /> Crear el primero
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.siguientes.map((t) => <FilaTardeo key={t.id} t={t} enlace={enlace} />)}
            </ul>
          )}
        </section>
      </div>
    </SeccionPanel>
  );
}
