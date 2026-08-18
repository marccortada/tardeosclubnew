"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Sparkles, Upload, X, Loader2 } from "lucide-react";

/**
 * Zona para soltar el flyer y decidir qué hacer con él.
 *
 * Antes había que elegir ANTES de subir si querías que lo leyera la IA, y eso
 * obliga a decidir sin haber visto siquiera la imagen. Ahora se suelta el
 * archivo y luego se elige: "Analizar con IA" rellena los campos leyendo el
 * flyer, y "Solo subir" lo usa tal cual sin tocar nada.
 *
 * Se puede arrastrar, pegar del portapapeles o abrir el explorador. Arrastrar
 * es lo que hace todo el mundo con un flyer que acaba de descargarse; obligar a
 * pasar por el explorador es un paso de más cada vez.
 */
export default function SubirFlyer({
  archivo,
  onArchivo,
  onAnalizar,
  analizando,
  puedeAnalizar = true,
  decidido,
  onSoloSubir,
}: {
  archivo: File | null;
  onArchivo: (f: File | null) => void;
  onAnalizar: () => void;
  analizando?: boolean;
  /** false cuando la IA no está disponible (sin saldo, por ejemplo). */
  puedeAnalizar?: boolean;
  /** Ya se eligió qué hacer con el flyer: se deja de preguntar. */
  decidido?: boolean;
  onSoloSubir: () => void;
}) {
  const [encima, setEncima] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const coger = (f: File | null | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    onArchivo(f);
    // La previa se hace en el navegador: subir la imagen solo para enseñarla
    // sería un viaje de ida y vuelta antes de que el usuario decida nada.
    setPrevia((anterior) => { if (anterior) URL.revokeObjectURL(anterior); return URL.createObjectURL(f); });
  };

  const quitar = () => {
    if (previa) URL.revokeObjectURL(previa);
    setPrevia(null);
    onArchivo(null);
    if (input.current) input.current.value = "";
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => { e.preventDefault(); setEncima(false); coger(e.dataTransfer.files?.[0]); }}
      onPaste={(e) => coger(e.clipboardData.files?.[0])}
      className={`rounded-2xl border-2 border-dashed p-4 transition ${
        encima ? "border-magenta bg-magenta-50" : "border-magenta-200 bg-magenta-50/40"
      }`}
    >
      <p className="flex items-center gap-2 font-black text-tinta/80">
        <Sparkles size={17} className="text-magenta" /> Sube el flyer
      </p>
      <p className="mt-0.5 text-sm font-semibold text-tinta/55">
        Arrástralo aquí, pégalo con Cmd+V o púlsalo para buscarlo. Después eliges si lo lee la IA.
      </p>

      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={(e) => coger(e.target.files?.[0])}
        className="hidden"
      />

      {!archivo ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-extrabold text-magenta ring-2 ring-magenta transition hover:bg-magenta-50"
        >
          <Upload size={18} /> Elegir flyer
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {previa && (
              <Image src={previa} alt="" width={110} height={138} unoptimized
                className="h-[110px] w-[88px] rounded-xl object-cover ring-1 ring-black/10" />
            )}
            <button type="button" onClick={quitar} aria-label="Quitar el flyer"
              className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-tinta text-white shadow">
              <X size={14} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-tinta/60">{archivo.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => input.current?.click()}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-tinta/70 ring-1 ring-magenta-100">
                Cambiar
              </button>
              {/* Las dos salidas, a la vista. "Solo subir" no sube nada por su
                  cuenta —el archivo viaja al publicar—: lo que hace es cerrar la
                  decisión, para que quede claro que se puede seguir a mano. */}
              {!decidido && (
                <>
                  <button
                    type="button"
                    onClick={onSoloSubir}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-oro px-4 py-2.5 text-sm font-extrabold text-tinta transition hover:brightness-105"
                  >
                    <Upload size={15} /> Solo subir
                  </button>
                  <button
                    type="button"
                    onClick={onAnalizar}
                    disabled={analizando || !puedeAnalizar}
                    title={puedeAnalizar ? "" : "La lectura con IA no está disponible ahora mismo"}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-magenta px-4 py-2.5 text-sm font-extrabold text-white transition disabled:opacity-40"
                  >
                    {analizando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {analizando ? "Leyendo el flyer…" : "Analizar con IA"}
                  </button>
                </>
              )}
            </div>
            <p className="mt-1.5 text-xs font-semibold text-tinta/45">
              {decidido
                ? "Este flyer se usará tal cual. Rellena los datos abajo."
                : "Con la IA se rellenan título, fecha, hora y estilo leyendo la imagen. Puedes corregir lo que salga mal."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
