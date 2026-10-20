"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Upload, Download, ExternalLink, RefreshCw, Trash2, X, CheckCircle2 } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Boton, { claseBoton } from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";
import { supabase } from "@/lib/supabase";
import { updateMiDj, falloPorColumna } from "@/lib/tardeos";
import { useDj } from "../contexto";

/**
 * PressKit del DJ: un PDF con su bio, fotos, rider y contacto que los locales
 * ven y descargan desde su ficha.
 *
 * Lo pide el documento del cliente: ver dentro de la web y descargar, límite
 * orientativo de 10 MB, comprobar que es un PDF, errores de carga claros,
 * sustituir (solo cuenta la versión vigente) y una alternativa en el móvil,
 * donde muchos navegadores no pintan PDF incrustados.
 */

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const BUCKET = "flyers";
const LOTE_47 = "Esta sección aún no está disponible: el PressKit todavía no se puede guardar.";

const mb = (b: number) => (b / 1024 / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 });

/** Ruta dentro del bucket a partir de la URL pública (para borrar el viejo). */
function rutaEnBucket(url: string | null | undefined): string | null {
  const m = (url ?? "").match(new RegExp(`/storage/v1/object/public/${BUCKET}/(presskits/[^?#]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Fecha de subida, sacada del nombre (`presskits/<id>-<milisegundos>.pdf`). */
function fechaDeSubida(url: string | null | undefined): string | null {
  const m = (url ?? "").match(/-(\d{13})\.pdf/i);
  if (!m) return null;
  return new Date(Number(m[1])).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Comprueba ANTES de subir: extensión/tipo, tamaño y que el contenido empiece
 * por "%PDF-". Un .pdf renombrado o una foto con otro nombre se paran aquí y
 * no después de esperar a que suba.
 */
async function validar(file: File): Promise<string | null> {
  const esPdf = file.type === "application/pdf" || (!file.type && /\.pdf$/i.test(file.name));
  if (!esPdf) return `«${file.name}» no es un PDF. Exporta tu PressKit como PDF (en Word, Canva o Pages: Guardar como → PDF).`;
  if (file.size === 0) return "El archivo está vacío. Vuelve a exportarlo.";
  if (file.size > MAX_BYTES) {
    return `Pesa ${mb(file.size)} MB y el máximo es ${MAX_MB} MB. Prueba a exportarlo con calidad «para web» o a comprimirlo (por ejemplo con ilovepdf.com).`;
  }
  try {
    const cabecera = await file.slice(0, 5).text();
    if (cabecera !== "%PDF-") return "El archivo dice ser un PDF pero no lo es por dentro. Vuelve a exportarlo como PDF.";
  } catch {
    return "No hemos podido leer el archivo. Prueba a elegirlo otra vez.";
  }
  return null;
}

type Subida =
  | { fase: "nada" }
  | { fase: "listo"; file: File }
  | { fase: "subiendo"; file: File; pct: number }
  | { fase: "guardando"; file: File };

export default function PressKitDj() {
  const { dj, actualizar, sinColumnaPresskit, modoAdmin } = useDj();
  const actual = dj.presskit_url ?? null;
  const [subida, setSubida] = useState<Subida>({ fase: "nada" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [faltaLote, setFaltaLote] = useState(sinColumnaPresskit);
  const [borrar, setBorrar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  // Visor incrustado solo en pantallas grandes con ratón: en móvil la mayoría
  // de navegadores no pintan el PDF (o lo descargan solos), así que allí se
  // ofrecen los botones de abrir y descargar.
  const [escritorio, setEscritorio] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    const ver = () => setEscritorio(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, []);

  const ocupado = subida.fase === "subiendo" || subida.fase === "guardando";

  const elegir = async (file?: File) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError(""); setOk("");
    const fallo = await validar(file);
    if (fallo) { setSubida({ fase: "nada" }); setError(fallo); return; }
    setSubida({ fase: "listo", file });
  };

  /**
   * Subida con XMLHttpRequest y no con supabase-js: es la única forma de tener
   * el porcentaje real. Con 10 MB por datos móviles son medio minuto o más, y
   * una rueda girando sin más parece que se ha colgado.
   */
  const subirArchivo = (file: File, ruta: string, token: string) =>
    new Promise<void>((ok, ko) => {
      const x = new XMLHttpRequest();
      xhr.current = x;
      x.open("POST", `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${ruta}`);
      x.setRequestHeader("Authorization", `Bearer ${token}`);
      x.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
      x.setRequestHeader("Content-Type", "application/pdf");
      x.setRequestHeader("x-upsert", "false");
      x.setRequestHeader("cache-control", "3600");
      x.timeout = 5 * 60 * 1000;
      x.upload.onprogress = (e) => {
        if (e.lengthComputable) setSubida({ fase: "subiendo", file, pct: Math.round((e.loaded / e.total) * 100) });
      };
      x.onload = () => {
        if (x.status >= 200 && x.status < 300) return ok();
        let msg = "";
        try { msg = String(JSON.parse(x.responseText)?.message ?? ""); } catch { /* sin cuerpo */ }
        if (x.status === 413 || /size|large|grande/i.test(msg)) ko(new Error("El servidor no admite un archivo tan grande. Prueba con un PDF más ligero."));
        else if (/mime|content.?type/i.test(msg)) ko(new Error("El almacenamiento todavía no acepta PDF. Avisa a quien administra la web."));
        else if (x.status === 401 || x.status === 403) ko(new Error("No tienes permiso para subir aquí. Sal y vuelve a entrar en tu cuenta."));
        else ko(new Error(`No se pudo subir el archivo${msg ? ` (${msg})` : ""}. Vuelve a intentarlo.`));
      };
      x.onerror = () => ko(new Error("Se ha cortado la conexión mientras subía. Comprueba el wifi o los datos y vuelve a intentarlo."));
      x.ontimeout = () => ko(new Error("La subida ha tardado demasiado. Prueba con mejor conexión o con un PDF más ligero."));
      x.onabort = () => ko(new Error("CANCELADO"));
      x.send(file);
    });

  const subir = async () => {
    if (subida.fase !== "listo") return;
    const file = subida.file;
    setError(""); setOk("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Tu sesión ha caducado. Vuelve a entrar para subir el PressKit."); return; }

    // Nombre nuevo en cada versión: así nadie ve la anterior por caché.
    const ruta = `presskits/${dj.id}-${Date.now()}.pdf`;
    setSubida({ fase: "subiendo", file, pct: 0 });
    try {
      await subirArchivo(file, ruta, token);
    } catch (e) {
      const msg = (e as Error).message;
      setSubida(msg === "CANCELADO" ? { fase: "listo", file } : { fase: "nada" });
      if (msg !== "CANCELADO") setError(msg);
      return;
    } finally {
      xhr.current = null;
    }

    setSubida({ fase: "guardando", file });
    const url = supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
    const { data: filas, error: e } = await updateMiDj(dj.id, { presskit_url: url });
    if (e || !filas?.length) {
      // El fichero ya está arriba pero la ficha no apunta a él: se quita para
      // no dejar huérfanos.
      await supabase.storage.from(BUCKET).remove([ruta]);
      setSubida({ fase: "nada" });
      if (falloPorColumna(e, "presskit_url")) { setFaltaLote(true); setError(LOTE_47); }
      else if (!e) setError("No se guardó: ¿tienes permiso para editar esta ficha? Si es tuya, escríbenos desde Ayuda.");
      else setError("El PDF se subió pero no se pudo guardar en tu ficha. Vuelve a intentarlo.");
      return;
    }
    // La versión anterior deja de valer: se borra (si falla, no pasa nada; la
    // ficha ya apunta a la nueva).
    const vieja = rutaEnBucket(actual);
    if (vieja && vieja !== ruta) void supabase.storage.from(BUCKET).remove([vieja]);
    actualizar({ presskit_url: url });
    setSubida({ fase: "nada" });
    setOk(actual ? "PressKit sustituido. La versión nueva es la que ven los locales." : "PressKit subido. Ya aparece en tu ficha pública.");
  };

  const eliminar = async () => {
    setBorrando(true); setError(""); setOk("");
    const { data: filas, error: e } = await updateMiDj(dj.id, { presskit_url: null });
    setBorrando(false);
    setBorrar(false);
    if (!e && !filas?.length) {
      setError("No se guardó: ¿tienes permiso para editar esta ficha? Si es tuya, escríbenos desde Ayuda.");
      return;
    }
    if (e) {
      if (falloPorColumna(e, "presskit_url")) { setFaltaLote(true); setError(LOTE_47); }
      else setError("No se pudo quitar el PressKit. Vuelve a intentarlo.");
      return;
    }
    const vieja = rutaEnBucket(actual);
    if (vieja) void supabase.storage.from(BUCKET).remove([vieja]);
    actualizar({ presskit_url: null });
    setOk("PressKit eliminado. Ya no aparece en tu ficha.");
  };

  const nombreDescarga = `PressKit-${dj.nombre_artistico.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "DJ"}.pdf`;
  // `?download=` hace que Supabase lo sirva como descarga con ese nombre; el
  // atributo `download` no vale entre dominios distintos.
  const urlDescarga = actual ? `${actual}${actual.includes("?") ? "&" : "?"}download=${encodeURIComponent(nombreDescarga)}` : null;
  const fecha = fechaDeSubida(actual);

  const soltar = (e: React.DragEvent) => {
    e.preventDefault(); setArrastrando(false);
    if (!ocupado && !faltaLote) elegir(e.dataTransfer.files?.[0]);
  };

  return (
    <SeccionPanel
      titulo="PressKit"
      descripcion="Tu dossier en PDF: bio, fotos, rider técnico y contacto. Los locales lo ven y lo descargan desde tu ficha."
    >
      {modoAdmin && <Aviso tono="aviso">Editando el PressKit de {dj.nombre_artistico} como administración.</Aviso>}
      {faltaLote && <Aviso tono="error">{LOTE_47}</Aviso>}
      {error && !(faltaLote && error === LOTE_47) && <Aviso tono="error">{error}</Aviso>}
      {ok && <Aviso tono="ok">{ok}</Aviso>}

      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />

      {/* Paso de confirmación / progreso de una subida */}
      {subida.fase !== "nada" && (
        <section className="mb-4 rounded-2xl border border-magenta/30 bg-white p-4 shadow-tarjeta md:p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><FileText size={24} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{subida.file.name}</p>
              <p className="text-sm text-tinta-suave">{mb(subida.file.size)} MB · PDF correcto</p>
            </div>
          </div>

          {subida.fase === "listo" && (
            <>
              <p className="mt-3 text-[15px]">
                {actual ? <>Va a <b>sustituir</b> al PressKit actual. El anterior dejará de verse.</> : "Listo para subir."}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Boton onClick={subir} className="sm:flex-1"><Upload size={20} aria-hidden /> {actual ? "Subir y sustituir" : "Subir PressKit"}</Boton>
                <Boton variante="contorno" onClick={() => setSubida({ fase: "nada" })}>Cancelar</Boton>
              </div>
            </>
          )}

          {subida.fase === "subiendo" && (
            <>
              <div className="mt-4 flex items-center justify-between text-[15px]">
                <span className="font-semibold">Subiendo…</span>
                <span className="tabular-nums text-tinta-suave">{subida.pct} %</span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-marfil-200" role="progressbar" aria-valuenow={subida.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de la subida">
                <div className="h-full rounded-full bg-magenta transition-[width]" style={{ width: `${subida.pct}%` }} />
              </div>
              <p className="mt-2 text-sm text-tinta-suave">No cierres esta página hasta que termine.</p>
              <Boton variante="contorno" tamano="pequeno" className="mt-3" onClick={() => xhr.current?.abort()}>
                <X size={18} aria-hidden /> Cancelar subida
              </Boton>
            </>
          )}

          {subida.fase === "guardando" && (
            <p className="mt-3 text-[15px] font-semibold">Guardando en tu ficha…</p>
          )}
        </section>
      )}

      {actual ? (
        <>
          {/* Versión vigente */}
          <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ok-fondo text-ok"><CheckCircle2 size={24} aria-hidden /></span>
                <div>
                  <p className="text-lg font-bold">Tu PressKit está publicado</p>
                  <p className="text-[15px] text-tinta-suave">Versión vigente{fecha ? ` · subida el ${fecha}` : ""}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={actual} target="_blank" rel="noopener noreferrer" className={claseBoton("contorno", "pequeno")}>
                  <ExternalLink size={18} aria-hidden /> Abrir en pestaña
                </a>
                {urlDescarga && (
                  <a href={urlDescarga} className={claseBoton("contorno", "pequeno")}>
                    <Download size={18} aria-hidden /> Descargar PDF
                  </a>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-linea pt-4">
              {escritorio ? (
                <object data={`${actual}#view=FitH`} type="application/pdf" aria-label="Vista previa del PressKit"
                  className="h-[70vh] min-h-[480px] w-full rounded-xl border border-linea bg-marfil-100">
                  {/* Si el navegador no sabe pintar PDF, sale esto. */}
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-[15px] text-tinta-suave">Tu navegador no puede enseñar el PDF aquí dentro.</p>
                    <a href={actual} target="_blank" rel="noopener noreferrer" className={claseBoton("primario", "pequeno")}>Abrir el PDF</a>
                  </div>
                </object>
              ) : (
                <p className="rounded-xl bg-marfil-100 p-4 text-[15px] text-tinta-suave">
                  En el móvil el PDF se ve mejor abierto aparte: usa «Abrir en pestaña» o «Descargar PDF».
                </p>
              )}
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
            <h2 className="text-lg font-bold">¿Tienes una versión nueva?</h2>
            <p className="mt-0.5 text-[15px] text-tinta-suave">Súbela y sustituirá a esta. Solo se ve la última. PDF de hasta {MAX_MB} MB.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Boton variante="contorno" onClick={() => input.current?.click()} disabled={ocupado || faltaLote}>
                <RefreshCw size={18} aria-hidden /> Sustituir por otro PDF
              </Boton>
              <Boton variante="contorno" onClick={() => setBorrar(true)} disabled={ocupado || faltaLote} className="text-error">
                <Trash2 size={18} aria-hidden /> Eliminar PressKit
              </Boton>
            </div>
          </section>
        </>
      ) : (
        subida.fase === "nada" && (
          <section
            onDragOver={(e) => { e.preventDefault(); if (!faltaLote) setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors md:p-10 ${
              arrastrando ? "border-magenta bg-magenta-50" : "border-linea-fuerte bg-white"
            }`}
          >
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-magenta-50 text-magenta"><FileText size={32} aria-hidden /></span>
            <h2 className="mt-4 text-xl font-bold">Aún no has subido tu PressKit</h2>
            <p className="mx-auto mt-1 max-w-md text-[15px] text-tinta-suave">
              Los locales lo buscan antes de contratar. Un PDF de 2 a 6 páginas con tu bio, fotos, rider técnico y contacto es suficiente.
            </p>
            <Boton onClick={() => input.current?.click()} disabled={faltaLote} className="mt-5">
              <Upload size={20} aria-hidden /> Elegir PDF
            </Boton>
            <p className="mt-2 text-sm text-tinta-suave">
              Solo PDF, máximo {MAX_MB} MB.<span className="hidden md:inline"> También puedes arrastrarlo aquí.</span>
            </p>
          </section>
        )
      )}

      <Hoja
        abierta={borrar}
        onCerrar={() => !borrando && setBorrar(false)}
        titulo="¿Eliminar tu PressKit?"
        pie={
          <div className="flex gap-2">
            <Boton variante="contorno" onClick={() => setBorrar(false)} disabled={borrando} className="flex-1">Cancelar</Boton>
            <Boton variante="peligro" onClick={eliminar} cargando={borrando} className="flex-1">Eliminar</Boton>
          </div>
        }
      >
        <p className="text-base">Dejará de aparecer en tu ficha pública y los locales no podrán descargarlo. Puedes subir otro cuando quieras.</p>
      </Hoja>
    </SeccionPanel>
  );
}
