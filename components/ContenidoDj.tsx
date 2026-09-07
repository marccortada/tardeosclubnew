"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  getContenidos, anadirContenido, borrarContenido, subirImagenDj,
  TIPOS_CONTENIDO, type Contenido,
} from "@/lib/djs";
import { Loader2, Plus, Trash2, Upload, Music2, Video, ImageIcon, ExternalLink } from "lucide-react";
import { urlSegura } from "@/lib/enlaces";

const ICONO = { sesion: Music2, video: Video, foto: ImageIcon, flyer: ImageIcon };

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
  const [tipo, setTipo] = useState<string>("sesion");
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const archivo = useRef<HTMLInputElement>(null);

  const esImagen = tipo === "foto" || tipo === "flyer";

  const recargar = async () => { setLista(await getContenidos(djId)); setCargando(false); };
  useEffect(() => { recargar(); }, [djId]); // eslint-disable-line react-hooks/exhaustive-deps

  const anadir = async (urlFinal: string) => {
    setOcupado(true); setError("");
    const { error: e } = await anadirContenido(djId, tipo, urlFinal, titulo);
    setOcupado(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    setUrl(""); setTitulo("");
    recargar();
  };

  const subir = async (f: File | undefined) => {
    if (!f) return;
    setOcupado(true); setError("");
    const u = await subirImagenDj(djId, f);
    if (!u) { setOcupado(false); setError("No se pudo subir la imagen."); return; }
    await anadir(u);
    if (archivo.current) archivo.current.value = "";
  };

  const quitar = async (c: Contenido) => {
    if (!confirm("¿Quitar esto de tu perfil?")) return;
    const { error: e } = await borrarContenido(c.id);
    if (e) { setError("No se pudo quitar: " + e.message); return; }
    recargar();
  };

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-xl font-black md:text-2xl">Mi contenido</h2>

      <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPOS_CONTENIDO.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => { setTipo(t.k); setUrl(""); setError(""); }}
              className={`rounded-xl px-3 py-2.5 text-left transition ${
                tipo === t.k ? "bg-magenta-50 ring-2 ring-magenta" : "bg-white ring-1 ring-magenta-100 hover:ring-magenta"
              }`}
            >
              <span className={`block text-sm font-extrabold ${tipo === t.k ? "text-magenta-700" : "text-tinta/80"}`}>{t.label}</span>
              <span className="block text-xs font-semibold text-tinta/50">{t.pie}</span>
            </button>
          ))}
        </div>

        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título (opcional): «Sesión Sant Joan 2026»"
          className="mt-3 w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
        />

        {esImagen ? (
          <>
            <input ref={archivo} type="file" accept="image/*" className="hidden"
              onChange={(e) => subir(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => archivo.current?.click()}
              disabled={ocupado}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-magenta py-3.5 font-extrabold text-white disabled:opacity-40"
            >
              {ocupado ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} Subir imagen
            </button>
          </>
        ) : (
          <div className="mt-2 flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={tipo === "video" ? "https://youtube.com/watch?v=…" : "https://soundcloud.com/…"}
              className="min-w-0 flex-1 rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta"
            />
            <button
              type="button"
              onClick={() => anadir(url)}
              disabled={ocupado || !url.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-magenta px-5 font-extrabold text-white disabled:opacity-40"
            >
              {ocupado ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Añadir
            </button>
          </div>
        )}

        {error && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      </div>

      {cargando ? (
        <p className="mt-3 flex items-center gap-2 text-tinta/50"><Loader2 size={16} className="animate-spin" /> Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
          Todavía no has subido nada. Tus sesiones y fotos salen en tu ficha pública.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {lista.map((c) => {
            const Icono = ICONO[c.tipo] ?? Music2;
            const imagen = c.tipo === "foto" || c.tipo === "flyer";
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-tarjeta ring-1 ring-black/5">
                {imagen ? (
                  <Image src={c.url} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><Icono size={22} /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black leading-tight">{c.titulo || TIPOS_CONTENIDO.find((t) => t.k === c.tipo)?.label}</p>
                  <a href={urlSegura(c.url) ?? "#"} target="_blank" rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 truncate text-xs font-semibold text-magenta">
                    Ver <ExternalLink size={11} />
                  </a>
                </div>
                <button onClick={() => quitar(c)} aria-label="Quitar"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-tinta/40 transition hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
