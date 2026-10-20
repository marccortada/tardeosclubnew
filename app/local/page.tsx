"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, ExternalLink, Share2, BadgeCheck, Check, ArrowRight, FileText,
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
import { MARCA } from "@/lib/marca";

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
 * Inicio del panel: corto. Si la ficha no se ve, por qué; la acción principal
 * (crear tardeo) y compartir; los dos próximos tardeos y tres cifras. Antes
 * eran cuatro tarjetas con subtítulo, tres atajos y la lista: en el móvil la
 * acción principal quedaba debajo de la primera pantalla. El resto (lista
 * entera, fotos, datos) tiene su sección en el menú.
 *
 * Todo se pide a la vez. Antes eran cuatro esperas en fila (local, tardeos,
 * métricas, apuntados) y el panel tardaba la suma de las cuatro en aparecer.
 */
export default function ResumenLocal() {
  const { ficha, enlace } = useFicha();
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
        await navigator.share({ title: ficha.nombre, text: `${ficha.nombre} en ${MARCA.nombre}`, url: urlFicha });
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

  // Sin subtítulos: la etiqueta ya dice qué es y el detalle está en su sección.
  const kpis = [
    { label: "Confirmados", valor: d?.apuntados, href: "/local/apuntados" },
    { label: "Próximos", valor: d?.proximos, href: "/local/tardeos" },
    { label: "Visitas", valor: d?.visitas, href: "/local/estadisticas" },
  ];

  return (
    <SeccionPanel
      titulo={ficha.nombre}
      acciones={
        <>
          {ficha.verificado
            ? <Etiqueta tono="ok"><BadgeCheck size={14} aria-hidden /> Verificado</Etiqueta>
            : publica ? <Etiqueta tono="ok">Publicada</Etiqueta> : <Etiqueta tono="aviso">Sin publicar</Etiqueta>}
          <Link href={`/locales/${ficha.id}`} target="_blank"
            className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-magenta-700 underline-offset-2 hover:underline">
            {publica ? "Ver mi ficha" : "Vista previa de mi ficha"} <ExternalLink size={14} aria-hidden />
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Por qué no se ve la ficha. Va lo primero: si tu local no sale en
            la web, es lo único que te importa. */}
        <FichaPendiente estado={ficha.estado} local={ficha} hrefEditar={enlace("/local/editar")} />

        {/* Las dos acciones de cada semana, a mano del pulgar. */}
        <section aria-label="Acciones" className="grid gap-3 sm:grid-cols-2">
          <Link href={enlace("/local/crear")}
            className="flex min-h-[72px] items-center gap-4 rounded-2xl bg-magenta p-4 text-white shadow-tarjeta transition hover:bg-magenta-600">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15"><Sparkles size={22} aria-hidden /></span>
            <span>
              <span className="block text-[17px] font-bold leading-tight">Crear tardeo</span>
              <span className="text-sm text-white/90">Sube el flyer y lo rellenamos</span>
            </span>
          </Link>
          <button type="button" onClick={compartir} disabled={!publica}
            className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-linea bg-white p-4 text-left shadow-tarjeta transition hover:border-linea-fuerte disabled:cursor-not-allowed disabled:opacity-60">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
              {compartido === "copiado" ? <Check size={22} aria-hidden /> : <Share2 size={22} aria-hidden />}
            </span>
            <span>
              <span className="block text-[17px] font-bold leading-tight">Compartir mi ficha</span>
              <span className="text-sm text-tinta-suave" aria-live="polite">
                {!publica ? "Podrás cuando esté publicada"
                  : compartido === "copiado" ? "Enlace copiado"
                  : compartido === "error" ? "No se pudo copiar. Inténtalo otra vez"
                  : "Por WhatsApp o donde quieras"}
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
              {[0, 1].map((i) => <div key={i} className="h-[94px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
            </div>
          ) : d.error ? (
            <p className="rounded-xl border border-error/20 bg-error-fondo p-4 text-[15px] font-semibold text-error">No se pudieron cargar: {d.error}</p>
          ) : d.siguientes.length === 0 ? (
            // Sin segundo botón de crear: el de arriba está a un palmo.
            <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-5 text-center text-[15px] text-tinta-suave">
              No tienes tardeos próximos publicados.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.siguientes.map((t) => <FilaTardeo key={t.id} t={t} enlace={enlace} />)}
            </ul>
          )}
        </section>

        {d?.errorCifras && (
          <p role="alert" className="-mb-3 rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">
            Algunas cifras no se han podido cargar: {d.errorCifras}
          </p>
        )}
        <section aria-label="Cifras" className="grid grid-cols-3 gap-2 sm:gap-3">
          {kpis.map(({ label, valor, href }) => (
            <Link key={label} href={enlace(href)} className="rounded-2xl border border-linea bg-white p-3 text-center shadow-tarjeta transition hover:border-linea-fuerte sm:p-4">
              <p className="text-[26px] font-bold leading-none tabular-nums">
                {d ? (valor ?? "—") : <span className="inline-block h-7 w-10 animate-pulse rounded bg-marfil-100" />}
              </p>
              <p className="mt-1.5 text-[14px] font-semibold text-tinta-suave">{label}</p>
            </Link>
          ))}
        </section>
        {/* Los borradores solo se mencionan si los hay: son trabajo a medias. */}
        {!!d?.borradores && (
          <Link href={enlace("/local/tardeos?filtro=borradores")}
            className="-mt-3 inline-flex min-h-[44px] items-center gap-2 self-start text-[15px] font-semibold text-magenta-700 hover:underline">
            <FileText size={17} aria-hidden /> {d.borradores} {d.borradores === 1 ? "borrador sin publicar" : "borradores sin publicar"} <ArrowRight size={16} aria-hidden />
          </Link>
        )}
      </div>
    </SeccionPanel>
  );
}
