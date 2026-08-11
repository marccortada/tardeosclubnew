"use client";
import Image from "next/image";

import { useRef, useState } from "react";
import { subirFotoLocal, updateMiLocal } from "@/lib/tardeos";
import { X, Loader2, ImagePlus } from "lucide-react";

export default function GestionFotosLocal({ localId, iniciales }: { localId: string; iniciales: string[] }) {
  const [fotos, setFotos] = useState<string[]>(iniciales);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const persistir = async (nuevas: string[]) => {
    setFotos(nuevas);
    await updateMiLocal(localId, { fotos: nuevas });
  };

  const onAdd = async (file: File) => {
    setSubiendo(true);
    const url = await subirFotoLocal(localId, file);
    if (url) await persistir([...fotos, url]);
    setSubiendo(false);
  };

  const quitar = (url: string) => persistir(fotos.filter((f) => f !== url));

  return (
    <section className="mt-7">
      <h2 className="font-display text-xl font-black md:text-2xl">Fotos del local</h2>
      <p className="mb-3 text-sm font-semibold text-tinta/60">La primera foto es la portada de tu página pública.</p>

      <div className="grid grid-cols-3 gap-3">
        {fotos.map((f, i) => (
          <div key={f} className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-black/5">
            <Image src={f} alt="" fill sizes="(max-width: 640px) 33vw, 200px" className="object-cover" />
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-magenta px-2 py-0.5 text-[10px] font-black text-white">Portada</span>
            )}
            <button
              onClick={() => quitar(f)}
              aria-label="Quitar foto"
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
            >
              <X size={15} />
            </button>
          </div>
        ))}

        <button
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
          className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-magenta-100 text-magenta transition hover:border-magenta hover:bg-magenta-50 disabled:opacity-60"
        >
          {subiendo ? (
            <Loader2 size={26} className="animate-spin" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs font-extrabold">
              <ImagePlus size={26} /> Añadir
            </span>
          )}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onAdd(e.target.files[0])}
      />
    </section>
  );
}
