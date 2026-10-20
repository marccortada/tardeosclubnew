"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, Download, Printer } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { claseBoton } from "@/components/Boton";
import { useFicha } from "../_panel/PanelLocal";
import { getTardeosDeLocal } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import { plegar } from "@/lib/texto";
import { SITE_URL } from "@/lib/seo";
import { generarQR, qrASvg } from "@/lib/qr";
import type { Tardeo } from "@/lib/types";
import { MARCA } from "@/lib/marca";

/**
 * QR imprimible del local (dossier pág. 14: "PDF con QR por local y
 * fidelización").
 *
 * El local lo pega en la barra, en la puerta o en las mesas: quien lo escanea
 * cae en la ficha del local (o en un tardeo concreto) y la visita llega
 * marcada con utm_source=qr, así en las estadísticas se ve cuánta gente viene
 * del papel y no de Instagram.
 *
 * El "PDF" lo hace el propio navegador con Imprimir → Guardar como PDF: no
 * hace falta generar PDFs en el servidor ni una librería para ello, y el
 * resultado es vectorial (el QR se imprime nítido a cualquier tamaño).
 */

type Papel = "A5" | "A4";
// A5 y A4 tienen la misma proporción (ISO 216), así que la hoja se diseña una
// vez en unidades relativas al ancho (cqw) y solo cambia el tamaño físico.
const MEDIDAS: Record<Papel, { ancho: string; alto: string }> = {
  A5: { ancho: "148mm", alto: "210mm" },
  A4: { ancho: "210mm", alto: "297mm" },
};

/** "Sala Güell · Sant Feliu" → "sala-guell-sant-feliu" (para utm_campaign). */
function slug(nombre: string): string {
  return plegar(nombre).trim().replace(/\s+/g, "-").slice(0, 60) || "local";
}

// Montado en el navegador (para el portal de impresión) sin setState en un
// efecto: el servidor dice false y el cliente true.
const nada = () => () => {};
const useEnNavegador = () => useSyncExternalStore(nada, () => true, () => false);

export default function QrDelLocal() {
  const { ficha, fichas, elegir, ajena } = useFicha();
  const [tardeos, setTardeos] = useState<Tardeo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tardeoId, setTardeoId] = useState("");
  const [papel, setPapel] = useState<Papel>("A5");
  const enNavegador = useEnNavegador();

  // Los próximos del local, para poder hacer el QR de uno concreto (p. ej. el
  // cartel de la fiesta de este sábado). Al cambiar de ficha se vacía la elección.
  useEffect(() => {
    let vivo = true;
    getTardeosDeLocal(ficha.id, "proximos", 0, 29).then((r) => {
      if (!vivo) return;
      setTardeos(r.data ?? []);
      setError(r.error?.message ?? null);
      setTardeoId("");
    });
    return () => { vivo = false; };
  }, [ficha.id]);

  const tardeo = tardeos?.find((t) => t.id === tardeoId) ?? null;
  const ruta = tardeo ? `/tardeos/${tardeo.id}` : `/locales/${ficha.id}`;
  const campana = slug(ficha.nombre);
  const url = `${SITE_URL}${ruta}?utm_source=qr&utm_medium=impreso&utm_campaign=${encodeURIComponent(campana)}`;
  // Lo que se lee debajo del QR: sin https ni UTM, para quien no pueda escanear.
  const urlCorta = `${SITE_URL.replace(/^https?:\/\//, "")}${ruta}`;

  const svg = useMemo(() => {
    try {
      return qrASvg(generarQR(url, "M"), { titulo: `Código QR: ${ficha.nombre}` });
    } catch {
      return null;
    }
  }, [url, ficha.nombre]);

  const descargarSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const enlaceBlob = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = enlaceBlob;
    a.download = `qr-${campana}${tardeo ? `-${tardeo.fecha}` : ""}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(enlaceBlob);
  };

  const hoja = (
    <Hoja
      nombre={ficha.nombre}
      tardeo={tardeo ? { titulo: tardeo.titulo, fecha: formatFecha(tardeo.fecha) } : null}
      svg={svg}
      urlCorta={urlCorta}
    />
  );
  const medida = MEDIDAS[papel];

  return (
    <SeccionPanel
      titulo="QR del local"
      descripcion="Imprímelo y ponlo en la barra, la puerta o las mesas: quien lo escanee verá tus tardeos."
    >
      {/* Estilos de impresión. Se imprime SOLO la hoja (que va en un portal
          colgado directamente de <body>), así no salen el menú ni la barra
          lateral, ni páginas en blanco por el contenido escondido. */}
      <style>{`
        .qr-impresion { display: none; }
        /* El papel es siempre claro: aunque la app esté en modo oscuro, la hoja
           se ve e imprime como saldrá (mismos valores que :root en claro). */
        .hoja-qr {
          --c-tinta: 26 26 26; --c-tinta-suave: 85 85 85; --c-linea: 229 229 229;
          --c-superficie: 255 255 255; color-scheme: light;
        }
        @media print {
          @page { size: ${papel} portrait; margin: 0; }
          :root { --c-fondo: 255 255 255; }
          body > *:not(.qr-impresion) { display: none !important; }
          .qr-impresion {
            display: block; width: ${medida.ancho}; height: ${medida.alto};
            overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="flex flex-col gap-5 rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
          {fichas.length > 1 && !ajena ? (
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-bold">Ficha</span>
              <select
                value={ficha.id}
                onChange={(e) => elegir(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-linea-fuerte bg-white px-3 text-[16px] outline-none focus:border-magenta focus:ring-4 focus:ring-magenta/15"
              >
                {fichas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </label>
          ) : (
            <div>
              <p className="text-[15px] font-bold">Ficha</p>
              <p className="text-[16px] text-tinta-suave">{ficha.nombre}</p>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[15px] font-bold">¿Adónde lleva el QR?</span>
            <select
              value={tardeoId}
              onChange={(e) => setTardeoId(e.target.value)}
              disabled={tardeos === null}
              className="min-h-[48px] w-full rounded-xl border border-linea-fuerte bg-white px-3 text-[16px] outline-none focus:border-magenta focus:ring-4 focus:ring-magenta/15 disabled:opacity-60"
            >
              <option value="">A la ficha del local (todos sus tardeos)</option>
              {(tardeos ?? []).map((t) => (
                <option key={t.id} value={t.id}>{formatFecha(t.fecha)} · {t.titulo}</option>
              ))}
            </select>
            <span className="mt-1.5 block text-[14px] text-tinta-suave">
              {tardeos === null ? "Cargando tus próximos tardeos…"
                : error ? "No se pudieron cargar tus tardeos; el QR de la ficha funciona igual."
                : tardeos.length === 0 ? "No tienes tardeos próximos: el QR lleva a tu ficha, que siempre está al día."
                : "La ficha del local vale para siempre. Un tardeo concreto, solo hasta ese día."}
            </span>
          </label>

          <fieldset>
            <legend className="mb-1.5 text-[15px] font-bold">Tamaño del papel</legend>
            <div className="flex gap-2">
              {(["A5", "A4"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={papel === p}
                  onClick={() => setPapel(p)}
                  className={`min-h-[48px] flex-1 rounded-xl border text-[16px] font-semibold ${
                    papel === p ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta"}`}
                >
                  {p}
                  <span className="block text-[12px] font-normal opacity-80">{p === "A5" ? "Mesa o barra" : "Puerta o pared"}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => window.print()} disabled={!svg} className={claseBoton("primario", "normal", true)}>
              <Printer size={19} aria-hidden /> Imprimir / Guardar como PDF
            </button>
            <button type="button" onClick={descargarSvg} disabled={!svg} className={claseBoton("contorno", "normal", true)}>
              <Download size={19} aria-hidden /> Descargar SVG
            </button>
          </div>

          {/* Lo técnico (cómo sacar el PDF, la dirección exacta) plegado:
              a la vista solo lo que hace falta para imprimir. */}
          <details className="group">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-tinta-suave">
              <ChevronDown size={17} className="transition group-open:rotate-180" aria-hidden /> Más info
            </summary>
            <p className="text-[15px] text-tinta-suave">
              Para el PDF, en la ventana de imprimir elige «Guardar como PDF». El SVG es solo el código,
              para tu imprenta o tu propio cartel.
            </p>
            <p className="mt-2 break-all text-[14px] text-tinta-suave">
              <span className="font-semibold text-tinta">Abre:</span> {url}
            </p>
          </details>
        </section>

        {/* Vista previa a escala: la misma hoja que se imprime. */}
        <section aria-label="Vista previa" className="flex justify-center">
          <div className="w-full max-w-[420px] overflow-hidden rounded-lg border border-linea shadow-elevada">
            {hoja}
          </div>
        </section>
      </div>

      {enNavegador && createPortal(<div className="qr-impresion" aria-hidden>{hoja}</div>, document.body)}
    </SeccionPanel>
  );
}

/**
 * La hoja en sí. Todas las medidas en cqw (% del ancho de la hoja): así la
 * vista previa del panel y el papel A5/A4 son idénticos, solo cambia la escala.
 */
function Hoja({ nombre, tardeo, svg, urlCorta }: {
  nombre: string;
  tardeo: { titulo: string; fecha: string } | null;
  svg: string | null;
  urlCorta: string;
}) {
  return (
    <div className="hoja-qr bg-superficie text-tinta [container-type:inline-size]">
      <div className="flex aspect-[148/210] w-full flex-col items-center px-[8cqw] pb-[6cqw] pt-[8cqw] text-center">
        <Image src="/branding/logo-transp.png" alt={MARCA.nombre} width={240} height={206} className="h-auto w-[24cqw]" />
        <p className="mt-[4cqw] text-[8cqw] font-extrabold leading-[1.05] tracking-tight">{nombre}</p>
        {tardeo && (
          <p className="mt-[2cqw] text-[4.2cqw] font-bold leading-tight text-magenta">
            {tardeo.titulo}
            <span className="block font-semibold text-tinta-suave">{tardeo.fecha}</span>
          </p>
        )}
        <p className="mt-[3cqw] text-[5cqw] font-semibold leading-tight">
          {tardeo ? "Escanea y descubre este tardeo" : "Escanea y descubre nuestros tardeos"}
        </p>
        <div className="mt-[3cqw] flex w-full flex-1 items-center justify-center">
          {svg ? (
            <div
              className="aspect-square h-auto w-[62cqw] max-w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
              // El SVG lo genera lib/qr.ts a partir de la URL: no lleva nada del usuario sin escapar.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p className="text-[4cqw] text-tinta-suave">No se ha podido generar el código.</p>
          )}
        </div>
        <p className="mt-[2cqw] break-all text-[3.4cqw] font-semibold leading-snug">{urlCorta}</p>
        <p className="mt-[1.5cqw] text-[2.8cqw] text-tinta-suave">Tardeos de tarde en la costa</p>
      </div>
    </div>
  );
}
