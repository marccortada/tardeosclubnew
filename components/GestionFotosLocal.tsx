"use client";
import Image from "next/image";

import { useRef, useState } from "react";
import { subirFotoLocal, updateMiLocal } from "@/lib/tardeos";
import { Trash2, Loader2, ImagePlus, Star, Check } from "lucide-react";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import { reducirImagen } from "@/app/local/_panel/reducirImagen";

/**
 * Las fotos del local. La primera es la portada de su página pública.
 *
 * Cada cambio se guarda al momento (no hay botón de guardar): quien sube una
 * foto y se va, espera encontrarla. Por eso cada paso dice si ha ido bien, y
 * si falla se vuelve a lo que había: antes la foto desaparecía de la pantalla
 * aunque la base no la hubiera quitado, y al volver estaba otra vez.
 */
export default function GestionFotosLocal({
  localId, iniciales, onCambio,
}: {
  localId: string;
  iniciales: string[];
  /** Avisa al panel para que la ficha en memoria no se quede con las viejas. */
  onCambio?: (fotos: string[]) => void;
}) {
  const [fotos, setFotos] = useState<string[]>(iniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [quitar, setQuitar] = useState<string | null>(null);
  const [quitando, setQuitando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const persistir = async (nuevas: string[], mensaje: string): Promise<boolean> => {
    const antes = fotos;
    setFotos(nuevas); setError(""); setOk("");
    const { data, error: e } = await updateMiLocal(localId, { fotos: nuevas });
    if (e || !data?.length) {
      setFotos(antes);
      setError(e ? `No se pudo guardar: ${e.message}` : "No se pudo guardar: no tienes permiso sobre esta ficha.");
      return false;
    }
    onCambio?.(nuevas);
    setOk(mensaje);
    return true;
  };

  const onAdd = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true); setError(""); setOk("");
    const subidas: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      // Reducida antes de subir: las fotos del móvil pesan varios MB.
      const url = await subirFotoLocal(localId, await reducirImagen(file));
      if (url) subidas.push(url);
    }
    setSubiendo(false);
    if (!subidas.length) { setError("No se pudo subir. Prueba con otra imagen (JPG o PNG)."); return; }
    await persistir([...fotos, ...subidas], subidas.length === 1 ? "Foto añadida." : `${subidas.length} fotos añadidas.`);
  };

  const confirmarQuitar = async () => {
    if (!quitar) return;
    setQuitando(true);
    await persistir(fotos.filter((f) => f !== quitar), "Foto quitada.");
    setQuitando(false);
    setQuitar(null);
  };

  const portada = (url: string) => persistir([url, ...fotos.filter((f) => f !== url)], "Portada cambiada.");

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-tinta-suave">
          {fotos.length === 0 ? "Aún no hay fotos." : `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}. La primera es la portada.`}
        </p>
        <Boton tamano="pequeno" onClick={() => fileRef.current?.click()} cargando={subiendo}>
          {!subiendo && <ImagePlus size={18} aria-hidden />} {subiendo ? "Subiendo…" : "Añadir fotos"}
        </Boton>
      </div>

      <div aria-live="polite">
        {error && <p role="alert" className="mt-3 rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
        {ok && !error && <p className="mt-3 flex items-center gap-2 rounded-xl bg-ok-fondo p-3 text-[15px] font-semibold text-ok"><Check size={18} aria-hidden /> {ok}</p>}
      </div>

      {fotos.length === 0 ? (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo}
          className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-linea-fuerte bg-white p-10 text-center text-tinta-suave transition hover:border-magenta hover:text-magenta-700">
          <ImagePlus size={32} aria-hidden />
          <span className="text-[16px] font-bold">Sube la primera foto</span>
          <span className="text-[15px]">La barra, la terraza, la pista llena. Se ve en tu página pública.</span>
        </button>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f, i) => (
            <li key={f} className="overflow-hidden rounded-2xl border border-linea bg-white shadow-tarjeta">
              <div className="relative aspect-square">
                <Image src={f} alt={`Foto ${i + 1} del local`} fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-magenta px-2.5 py-0.5 text-[13px] font-bold text-white">Portada</span>
                )}
              </div>
              <div className="flex gap-1 p-1.5">
                {i > 0 && (
                  <button type="button" onClick={() => portada(f)}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg text-[14px] font-semibold hover:bg-marfil-100">
                    <Star size={16} aria-hidden /> Portada
                  </button>
                )}
                <button type="button" onClick={() => setQuitar(f)} aria-label={`Quitar la foto ${i + 1}`}
                  className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 text-[14px] font-semibold text-error hover:bg-error-fondo ${i === 0 ? "flex-1" : ""}`}>
                  <Trash2 size={16} aria-hidden /> {i === 0 && "Quitar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
      />

      <Hoja abierta={!!quitar} onCerrar={() => !quitando && setQuitar(null)} titulo="¿Quitar esta foto?"
        pie={
          <div className="flex gap-2">
            <Boton variante="contorno" ancho onClick={() => setQuitar(null)} disabled={quitando}>Cancelar</Boton>
            <Boton variante="peligro" ancho onClick={confirmarQuitar} cargando={quitando}>Quitar</Boton>
          </div>
        }>
        {quitar && (
          <div className="flex items-center gap-4">
            <Image src={quitar} alt="" width={88} height={88} className="h-[88px] w-[88px] shrink-0 rounded-xl object-cover" />
            <p className="text-[15px] text-tinta-suave">Dejará de verse en tu página pública. Si la quieres otra vez, tendrás que volver a subirla.</p>
          </div>
        )}
      </Hoja>
    </section>
  );
}
