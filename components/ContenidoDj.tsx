"use client";

import { imagenParaSubir } from "@/app/local/_panel/reducirImagen";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  getContenidos, anadirContenido, borrarContenido, subirImagenDj,
  TIPOS_CONTENIDO, type Contenido,
} from "@/lib/djs";
import { Plus, Trash2, Upload, Music2, Video, ImageIcon, ExternalLink } from "lucide-react";
import { urlSegura } from "@/lib/enlaces";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";

const ICONO = { sesion: Music2, video: Video, foto: ImageIcon, flyer: ImageIcon };
const MAX_IMAGEN_MB = 10;

/**
 * Lo que un DJ sube a su perfil: sesiones, vídeos, flyers y fotos.
 *
 * Sesiones y vídeos van por enlace —los tiene ya en SoundCloud o YouTube—; los
 * flyers y las fotos se suben, que esas no viven en otro sitio. Por eso el
 * formulario cambia según lo que elija: pedir una URL para una foto del móvil
 * no lleva a ninguna parte.
 */
export default function ContenidoDj({ djId }: { djId: string }) {
  const [lista, setLista] = useState<Contenido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [tipo, setTipo] = useState<string>("sesion");
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [aQuitar, setAQuitar] = useState<Contenido | null>(null);
  const [quitando, setQuitando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const esImagen = tipo === "foto" || tipo === "flyer";
  const tipoActual = TIPOS_CONTENIDO.find((t) => t.k === tipo);

  const recargar = useCallback(
    () => getContenidos(djId).then(({ data, error: e }) => {
      setLista(data);
      setErrorCarga(e ? "No se pudo cargar lo que tienes subido. Revisa la conexión y vuelve a intentarlo." : "");
      setCargando(false);
    }),
    [djId],
  );
  useEffect(() => { recargar(); }, [recargar]);

  const anadir = async (urlFinal: string) => {
    setOcupado(true); setError(""); setOk("");
    const { error: e } = await anadirContenido(djId, tipo, urlFinal, titulo);
    setOcupado(false);
    if (e) { setError("No se pudo guardar: " + e.message); return false; }
    setUrl(""); setTitulo("");
    setOk("Añadido. Ya sale en tu ficha pública.");
    recargar();
    return true;
  };

  const anadirEnlace = () => {
    // Se valida aquí y no solo al pintar: un enlace que no abre no sirve de
    // nada en la ficha y el DJ no se enteraría hasta verla.
    const limpia = urlSegura(url);
    if (!limpia) { setError("Ese enlace no parece válido. Cópialo entero desde SoundCloud, YouTube…"); return; }
    anadir(limpia);
  };

  const subir = async (elegido: File | undefined) => {
    if (archivo.current) archivo.current.value = "";
    if (!elegido) return;
    let f: File;
    try { f = elegido.type.startsWith("image/") ? await imagenParaSubir(elegido) : elegido; }
    catch (e) { setError((e as Error).message); return; }
    setError(""); setOk("");
    if (!f.type.startsWith("image/")) { setError("Eso no es una imagen. Elige una foto JPG o PNG."); return; }
    if (f.size > MAX_IMAGEN_MB * 1024 * 1024) {
      setError(`La imagen pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_IMAGEN_MB} MB.`);
      return;
    }
    setOcupado(true);
    const u = await subirImagenDj(djId, f);
    if (!u) { setOcupado(false); setError("No se pudo subir la imagen. Revisa la conexión y vuelve a probar."); return; }
    await anadir(u);
  };

  const quitar = async () => {
    if (!aQuitar) return;
    setQuitando(true);
    const { error: e } = await borrarContenido(aQuitar.id);
    setQuitando(false);
    if (e) { setError("No se pudo quitar: " + e.message); setAQuitar(null); return; }
    setLista((l) => l.filter((x) => x.id !== aQuitar.id));
    setAQuitar(null);
    setOk("Quitado de tu ficha.");
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
        <h2 className="text-lg font-bold">Añadir</h2>
        <p className="mt-0.5 text-[15px] text-tinta-suave">1. Elige qué es. 2. Pega el enlace o sube la imagen.</p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Tipo de contenido">
          {TIPOS_CONTENIDO.map((t) => {
            const on = tipo === t.k;
            const Icono = ICONO[t.k];
            return (
              <button
                key={t.k}
                type="button"
                aria-pressed={on}
                onClick={() => { setTipo(t.k); setUrl(""); setError(""); setOk(""); }}
                className={`flex min-h-[64px] flex-col items-start justify-center rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  on ? "border-magenta bg-magenta-50" : "border-linea-fuerte bg-white hover:border-tinta/40"
                }`}
              >
                <span className={`flex items-center gap-1.5 text-[15px] font-bold ${on ? "text-magenta-700" : "text-tinta"}`}>
                  <Icono size={17} aria-hidden /> {t.label}
                </span>
                <span className="text-sm text-tinta-suave">{t.pie}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Campo etiqueta="Título (opcional)" htmlFor="cont-titulo">
            <input id="cont-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120}
              placeholder="Ej.: Sesión Sant Joan 2026" className={claseCampo} />
          </Campo>

          {esImagen ? (
            <>
              <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
              <Boton ancho cargando={ocupado} onClick={() => archivo.current?.click()}>
                {!ocupado && <Upload size={20} aria-hidden />} {ocupado ? "Subiendo…" : `Subir ${tipoActual?.label.toLowerCase() ?? "imagen"}`}
              </Boton>
              <p className="text-sm text-tinta-suave">JPG o PNG, máximo {MAX_IMAGEN_MB} MB.</p>
            </>
          ) : (
            <Campo etiqueta={tipo === "video" ? "Enlace del vídeo" : "Enlace de la sesión"} htmlFor="cont-url">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input id="cont-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) anadirEnlace(); }}
                  placeholder={tipo === "video" ? "https://youtube.com/watch?v=…" : "https://soundcloud.com/…"}
                  className={`${claseCampo} min-w-0 flex-1`} />
                <Boton onClick={anadirEnlace} cargando={ocupado} disabled={!url.trim()}>
                  {!ocupado && <Plus size={20} aria-hidden />} Añadir
                </Boton>
              </div>
            </Campo>
          )}

          {error && <Aviso tono="error">{error}</Aviso>}
          {ok && <Aviso tono="ok">{ok}</Aviso>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">En tu ficha {lista.length > 0 && <span className="font-medium text-tinta-suave">· {lista.length}</span>}</h2>
        {cargando ? (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
          </div>
        ) : errorCarga ? (
          <div className="flex flex-col items-start gap-3">
            <Aviso tono="error">{errorCarga}</Aviso>
            <Boton variante="contorno" tamano="pequeno" onClick={() => { setCargando(true); recargar(); }}>Reintentar</Boton>
          </div>
        ) : lista.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center text-[15px] text-tinta-suave">
            Todavía no has subido nada. Empieza por tu mejor sesión: es lo primero que mira un local antes de contratarte.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((c) => {
              const Icono = ICONO[c.tipo] ?? Music2;
              const imagen = c.tipo === "foto" || c.tipo === "flyer";
              const destino = urlSegura(c.url);
              const nombreTipo = TIPOS_CONTENIDO.find((t) => t.k === c.tipo)?.label;
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-linea bg-white p-3 shadow-tarjeta">
                  {imagen ? (
                    <Image src={c.url} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><Icono size={24} aria-hidden /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight">{c.titulo || nombreTipo}</p>
                    <p className="text-sm text-tinta-suave">{nombreTipo}</p>
                  </div>
                  {destino && (
                    <a href={destino} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Abrir ${c.titulo || nombreTipo}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-tinta-suave transition-colors hover:bg-marfil-100 hover:text-tinta">
                      <ExternalLink size={18} />
                    </a>
                  )}
                  <button onClick={() => setAQuitar(c)} aria-label={`Quitar ${c.titulo || nombreTipo}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-tinta-suave transition-colors hover:bg-error-fondo hover:text-error">
                    <Trash2 size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Hoja
        abierta={!!aQuitar}
        onCerrar={() => !quitando && setAQuitar(null)}
        titulo="¿Quitar de tu ficha?"
        pie={
          <div className="flex gap-2">
            <Boton variante="contorno" onClick={() => setAQuitar(null)} disabled={quitando} className="flex-1">Cancelar</Boton>
            <Boton variante="peligro" onClick={quitar} cargando={quitando} className="flex-1">Quitar</Boton>
          </div>
        }
      >
        <p className="text-base">
          «{aQuitar?.titulo || TIPOS_CONTENIDO.find((t) => t.k === aQuitar?.tipo)?.label}» dejará de verse en tu ficha pública.
        </p>
      </Hoja>
    </div>
  );
}
