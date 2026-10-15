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
      {/* La IA es lo que ahorra el trabajo: se dice arriba y con todas las
          letras, no como una opción escondida tras subir la imagen. */}
      <p className="flex items-center gap-2 text-[17px] font-bold text-tinta">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-magenta text-white"><Sparkles size={18} aria-hidden /></span>
        ¿Tienes el flyer? Lo leemos con IA
      </p>
      <p className="mt-1.5 text-[15px] text-tinta-suave">
        Rellenamos título, fecha, horas, DJ y precio. Tú solo revisas.
        {/* Arrastrar y pegar solo existen con ratón y teclado: en el móvil sobraba. */}
        <span className="hidden md:inline"> Puedes arrastrarlo aquí o pegarlo con Ctrl/Cmd+V.</span>
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
          className="mt-3 inline-flex min-h-tacto items-center gap-2 rounded-xl bg-magenta px-5 text-[17px] font-bold text-white transition hover:bg-magenta-600"
        >
          <Upload size={18} aria-hidden /> Subir el flyer
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {previa && (
              <Image src={previa} alt="" width={110} height={138} unoptimized
                className="h-[110px] w-[88px] rounded-xl object-cover ring-1 ring-black/10" />
            )}
            <button type="button" onClick={quitar} aria-label="Quitar el flyer"
              className="absolute -right-2 -top-2 grid h-10 w-10 place-items-center rounded-full bg-tinta text-white shadow">
              <X size={14} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-tinta-suave">{archivo.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => input.current?.click()}
                className="min-h-[44px] rounded-xl bg-white px-4 text-[15px] font-semibold text-tinta ring-1 ring-linea-fuerte">
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
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-4 text-[15px] font-semibold text-tinta ring-1 ring-linea-fuerte hover:bg-marfil-100"
                  >
                    <Upload size={16} aria-hidden /> Usarlo sin IA
                  </button>
                  <button
                    type="button"
                    onClick={onAnalizar}
                    disabled={analizando || !puedeAnalizar}
                    title={puedeAnalizar ? "" : "La lectura con IA no está disponible ahora mismo"}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-magenta px-4 text-[15px] font-bold text-white transition hover:bg-magenta-600 disabled:opacity-40"
                  >
                    {analizando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {analizando ? "Leyendo el flyer…" : "Analizar con IA"}
                  </button>
                </>
              )}
            </div>
            <p className="mt-1.5 text-sm text-tinta-suave">
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
