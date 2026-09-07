"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getResenasAprobadas, crearResena, miResena, apelarResena, etiquetaMotivo, Resena } from "@/lib/resenas";
import { Star, Loader2, Check, Ban } from "lucide-react";

export default function Resenas({
  tipo,
  objetivoId,
  nombre,
}: {
  tipo: "local" | "dj";
  objetivoId: string;
  nombre: string;
}) {
  const { user } = useAuth();
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [cargando, setCargando] = useState(true);
  /** La reseña propia, en el estado que esté. `null` = todavía no ha escrito. */
  const [mia, setMia] = useState<Resena | null>(null);
  const [apelacion, setApelacion] = useState("");
  const [apelando, setApelando] = useState(false);
  const [errorApel, setErrorApel] = useState("");
  const [puntos, setPuntos] = useState(0);
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");

  useEffect(() => {
    getResenasAprobadas(tipo, objetivoId).then((r) => { setResenas(r); setCargando(false); });
    // La suya, con estado: antes solo se preguntaba «¿ya la escribió?» y por
    // eso a quien se la rechazaban no se le decía nunca, ni podía saber por qué.
    if (user) miResena(user.id, tipo, objetivoId).then(setMia);
  }, [tipo, objetivoId, user]);

  const media = resenas.length ? resenas.reduce((a, r) => a + r.puntuacion, 0) / resenas.length : 0;

  const enviar = async () => {
    if (!user || puntos === 0) return;
    setEstado("enviando");
    const { error } = await crearResena(user.id, tipo, objetivoId, puntos, comentario);
    if (error) setEstado("error");
    else {
      setEstado("enviado");
      if (user) miResena(user.id, tipo, objetivoId).then(setMia);
    }
  };

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-black">Reseñas</h2>
        {resenas.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-oro/15 px-3 py-1 text-sm font-black text-oro-600">
            <Star size={14} fill="currentColor" /> {media.toFixed(1)} · {resenas.length}
          </span>
        )}
      </div>

      {/* Formulario de valoración */}
      {!user ? (
        <Link href="/perfil" className="block rounded-2xl bg-white p-4 text-center font-bold text-magenta shadow-tarjeta ring-1 ring-magenta-100">
          Entra para valorar {nombre}
        </Link>
      ) : mia?.estado === "rechazada" ? (
        /*
          Que se entere de que se la han rechazado, y de por qué.
          Antes desaparecía sin más: quien la escribía volvía a la ficha, no
          veía su reseña, y no tenía forma de saber si se había perdido, si
          seguía en cola o si alguien había decidido algo. Eso es lo que
          convierte una moderación normal en un agravio.
        */
        <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
          <p className="flex items-center gap-2 font-black">
            <Ban size={17} className="shrink-0 text-magenta" /> No publicamos tu reseña
          </p>
          <p className="mt-1 text-sm font-semibold text-tinta/70">
            Motivo: <b>{etiquetaMotivo(mia.motivo_rechazo).toLowerCase()}</b>.
            Si crees que nos hemos equivocado, dínoslo y la vuelve a mirar una persona.
          </p>
          <textarea
            value={apelacion} onChange={(e) => setApelacion(e.target.value)} rows={2} maxLength={500}
            placeholder="Por qué crees que hay un error…"
            className="mt-2 w-full rounded-xl border-2 border-magenta-100 px-3 py-2 text-sm font-semibold outline-none focus:border-magenta"
          />
          {errorApel && <p className="mt-1 text-sm font-bold text-magenta">{errorApel}</p>}
          <button
            onClick={async () => {
              setApelando(true); setErrorApel("");
              const r = await apelarResena(mia.id, apelacion);
              setApelando(false);
              if (!r.ok) { setErrorApel(r.error ?? "No se pudo enviar."); return; }
              setMia({ ...mia, estado: "apelada", apelacion });
            }}
            disabled={apelando || !apelacion.trim()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-tinta py-2.5 text-sm font-black text-white disabled:opacity-40"
          >
            {apelando ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />} Pedir que la revisen
          </button>
        </div>
      ) : mia?.estado === "apelada" ? (
        <div className="flex items-start gap-2 rounded-2xl bg-oro/10 p-4 text-sm font-bold text-tinta/80">
          <Check size={18} className="mt-0.5 shrink-0 text-oro-600" />
          Gracias. La vuelve a mirar una persona y te decimos algo.
        </div>
      ) : mia || estado === "enviado" ? (
        <div className="flex items-center gap-2 rounded-2xl bg-oro/10 p-4 text-sm font-bold text-tinta/80">
          <Check size={18} className="text-oro-600" />
          {mia?.estado === "aprobada"
            ? "Tu reseña está publicada. ¡Gracias!"
            : "¡Gracias! Tu reseña está pendiente de aprobación."}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
          <p className="mb-2 text-sm font-black text-tinta/70">¿Qué tal {nombre}?</p>
          <div className="mb-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setPuntos(n)} aria-label={`${n} estrellas`}>
                <Star size={32} className={n <= puntos ? "text-oro" : "text-black/15"} fill={n <= puntos ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Cuenta tu experiencia (opcional)…"
            className="w-full rounded-xl border-2 border-magenta-100 px-3 py-2 text-sm font-semibold outline-none focus:border-magenta" />
          {estado === "error" && <p className="mt-1 text-sm font-bold text-magenta">No se pudo enviar. ¿Ya la habías dejado?</p>}
          <button onClick={enviar} disabled={puntos === 0 || estado === "enviando"}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-3 font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40">
            {estado === "enviando" ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} />} Enviar reseña
          </button>
        </div>
      )}

      {/* Lista de reseñas aprobadas */}
      {cargando ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-tinta/40"><Loader2 size={16} className="animate-spin" /> Cargando reseñas…</div>
      ) : resenas.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {resenas.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <p className="font-black">{r.profiles?.display_name || "Tardícola"}</p>
                <span className="inline-flex items-center gap-0.5 text-sm font-black text-oro-600">
                  {r.puntuacion} <Star size={13} fill="currentColor" />
                </span>
              </div>
              {r.comentario && <p className="mt-1 text-sm font-semibold text-tinta/70">{r.comentario}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-center text-sm font-semibold text-tinta/40">Aún no hay reseñas. ¡Sé el primero!</p>
      )}
    </section>
  );
}
