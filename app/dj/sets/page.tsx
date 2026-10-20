"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Star, Trash2, MessageCircle, Heart, Bookmark, Loader2, Plus } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { BotonPlay, HojaComentarios } from "@/components/musica/piezas";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import { useDj } from "../contexto";
import {
  getSetsDeDj, crearSet, destacarSet, actualizarSet, borrarSet, plataformaDe, portadaDe, type SetDj,
} from "@/lib/sets";

const NOMBRE_PLATAFORMA: Record<string, string> = {
  soundcloud: "SoundCloud", youtube: "YouTube", mixcloud: "Mixcloud", audio: "Audio directo", otra: "Enlace externo",
};

/**
 * Publicar y gestionar sets (dossier pág. 7): publicar, destacar (uno), ordenar,
 * borrar, y ver/responder los comentarios de cada set. Los sets se escuchan,
 * no se descargan (aplazado por el cliente).
 */
export default function SetsDj() {
  const { dj } = useDj();
  const [sets, setSets] = useState<SetDj[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [portada, setPortada] = useState("");
  const [estilos, setEstilos] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [comentando, setComentando] = useState<SetDj | null>(null);
  // Set pendiente de confirmar el borrado (Hoja en vez de window.confirm, que
  // bloquea la app y en la PWA sale con la URL de título).
  const [aBorrar, setABorrar] = useState<SetDj | null>(null);
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await getSetsDeDj(dj.id);
    setSets(r.data); setError(r.error);
  }, [dj.id]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    // Mismas reglas que la tabla `sets` (lote 65), comprobadas aquí para dar un
    // mensaje claro: un título de solo espacios pasaba el `required` del
    // navegador, se recortaba a "" y la base respondía con un 400.
    const t = titulo.trim();
    if (!t) { setError("Ponle un título al set."); return; }
    if (t.length > 140) { setError(`El título es demasiado largo (${t.length} caracteres). Máximo 140.`); return; }
    // La base exige http(s):// sin distinguir mayúsculas; aquí igual.
    if (!/^https?:\/\//i.test(url.trim())) { setError("Pega el enlace completo del set (https://…)."); return; }
    // La portada no tiene restricción en la base, pero un enlace que no sea
    // http(s) rompe la imagen en la tarjeta: mejor avisar ahora.
    if (portada.trim() && !/^https?:\/\//i.test(portada.trim())) { setError("La portada debe ser un enlace completo a una imagen (https://…), o déjala vacía."); return; }
    setGuardando(true); setError(null);
    const err = await crearSet(dj.id, {
      titulo: t, url, portada: portada.trim() || null,
      estilos: estilos.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 6),
      destacado: !sets?.length, orden: (sets?.length ?? 0),
    });
    setGuardando(false);
    if (err) { setError(err); return; }
    setTitulo(""); setUrl(""); setPortada(""); setEstilos("");
    await cargar();
  }

  async function mover(i: number, d: -1 | 1) {
    if (!sets) return;
    const j = i + d;
    if (j < 0 || j >= sets.length) return;
    const a = sets[i], b = sets[j];
    // Se reescriben ambos con su posición en la lista: así el orden queda
    // estable aunque hubiera números repetidos.
    const e1 = await actualizarSet(a.id, { orden: j });
    const e2 = await actualizarSet(b.id, { orden: i });
    if (e1 || e2) setError(e1 || e2);
    await cargar();
  }

  const plat = url ? plataformaDe(url) : null;
  const campo = "min-h-tacto w-full rounded-xl border border-linea bg-superficie px-4 text-[16px]";

  return (
    <SeccionPanel titulo="Publicar set" descripcion="Tus sesiones de SoundCloud, YouTube, Mixcloud o un enlace de audio. Se escuchan en la app; no se descargan." ancho="estrecho">
      {/* Etiquetas visibles encima de cada campo: con el placeholder como
          etiqueta, en el móvil el texto se cortaba y al escribir desaparecía. */}
      <form onSubmit={publicar} className="flex flex-col gap-3 rounded-2xl border border-linea bg-superficie p-4">
        <Etiqueta texto="Título" pie="P. ej. Sunset Session">
          <input required maxLength={140} value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} />
        </Etiqueta>
        <Etiqueta texto="Enlace del set" pie="SoundCloud, YouTube, Mixcloud o audio directo">
          <input required type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={campo} />
        </Etiqueta>
        {plat && <p className="text-[14px] text-tinta-suave">Detectado: {NOMBRE_PLATAFORMA[plat]}{plat === "otra" ? " — se abrirá fuera de la app" : ""}</p>}
        <Etiqueta texto="Portada (opcional)" pie="Enlace a una imagen">
          <input type="url" inputMode="url" value={portada} onChange={(e) => setPortada(e.target.value)} placeholder="https://" className={campo} />
        </Etiqueta>
        <Etiqueta texto="Estilos" pie="Separados por comas: House, Disco">
          <input value={estilos} onChange={(e) => setEstilos(e.target.value)} className={campo} />
        </Etiqueta>
        <button type="submit" disabled={guardando} className="inline-flex min-h-tacto items-center justify-center gap-2 rounded-xl bg-magenta font-bold text-white disabled:opacity-50">
          {guardando ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Plus size={20} aria-hidden />} Publicar set
        </button>
      </form>

      {error && <p role="alert" className="mt-3 rounded-xl bg-error-fondo p-3 text-[15px] text-error">{error}</p>}

      <h2 className="mt-6 text-[18px] font-bold">Mis sets</h2>
      {sets === null ? <p className="mt-2 text-tinta-suave">Cargando…</p>
        : sets.length === 0 ? <p className="mt-2 text-[15px] text-tinta-suave">Aún no has publicado ninguno.</p>
        : (
          <ul className="mt-2 flex flex-col gap-2">
            {sets.map((s, i) => (
              <li key={s.id} className="rounded-2xl border border-linea bg-superficie p-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#2B0A26,#D61AA8)]">
                    {portadaDe(s) && <Image src={portadaDe(s)!} alt="" fill sizes="56px" unoptimized className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold">{s.titulo}</p>
                    <p className="text-[14px] text-tinta-suave">
                      {NOMBRE_PLATAFORMA[s.plataforma]}{s.destacado ? " · Destacado" : ""}{s.oculto ? " · Oculto por moderación" : ""}
                    </p>
                    <p className="mt-0.5 flex gap-3 text-[14px] text-tinta-suave">
                      <span className="inline-flex items-center gap-1"><Heart size={14} aria-hidden /> {s.likes}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle size={14} aria-hidden /> {s.comentarios}</span>
                      <span className="inline-flex items-center gap-1"><Bookmark size={14} aria-hidden /> {s.guardados}</span>
                    </p>
                  </div>
                  <BotonPlay set={s} autor={dj.nombre_artistico} className="border-2 border-magenta text-magenta" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Mini onClick={async () => { const e = await destacarSet(dj.id, s.id); if (e) setError(e); await cargar(); }} activo={s.destacado}>
                    <Star size={16} className={s.destacado ? "fill-current" : ""} aria-hidden /> {s.destacado ? "Destacado" : "Destacar"}
                  </Mini>
                  <Mini onClick={() => setComentando(s)}><MessageCircle size={16} aria-hidden /> Comentarios</Mini>
                  <Mini onClick={() => void mover(i, -1)} disabled={i === 0} etiqueta="Subir"><ArrowUp size={16} aria-hidden /></Mini>
                  <Mini onClick={() => void mover(i, 1)} disabled={i === sets.length - 1} etiqueta="Bajar"><ArrowDown size={16} aria-hidden /></Mini>
                  <Mini onClick={() => setABorrar(s)} etiqueta="Borrar"><Trash2 size={16} aria-hidden /></Mini>
                </div>
              </li>
            ))}
          </ul>
        )}

      <HojaComentarios setId={comentando?.id ?? null} titulo={comentando?.titulo ?? ""} abierta={!!comentando}
        onCerrar={() => { setComentando(null); void cargar(); }} soyDj nombreDj={dj.nombre_artistico} />
      <Hoja abierta={!!aBorrar} onCerrar={() => !borrando && setABorrar(null)} titulo="¿Borrar este set?"
        pie={
          <div className="flex gap-2">
            <Boton variante="contorno" ancho onClick={() => setABorrar(null)} disabled={borrando}>Cancelar</Boton>
            <Boton variante="peligro" ancho cargando={borrando} onClick={async () => {
              if (!aBorrar) return;
              setBorrando(true);
              const e = await borrarSet(aBorrar.id);
              setBorrando(false); setABorrar(null);
              if (e) setError(e);
              await cargar();
            }}>Borrar</Boton>
          </div>
        }>
        <p className="text-[15px] text-tinta-suave">
          «{aBorrar?.titulo}» desaparecerá con sus ♥ y comentarios. No se puede deshacer.
        </p>
      </Hoja>
      {/* Hueco para el mini‑reproductor fijo (su altura real, --alto-mini): sin él
          tapaba la segunda fila de botones del último set en el móvil. */}
      <div aria-hidden className="h-[var(--alto-mini,0px)]" />
    </SeccionPanel>
  );
}

function Etiqueta({ texto, pie, children }: { texto: string; pie?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[15px] font-bold text-tinta">{texto}</span>
      {children}
      {pie && <span className="text-[14px] text-tinta-suave">{pie}</span>}
    </label>
  );
}

function Mini({ children, onClick, disabled, etiqueta, activo }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; etiqueta?: string; activo?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={etiqueta}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-[14px] font-bold disabled:opacity-40 ${
        activo ? "border-magenta bg-magenta-50 text-magenta" : "border-linea text-tinta"}`}>
      {children}
    </button>
  );
}
