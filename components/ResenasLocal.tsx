"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getResenasAprobadas, crearResena, yaReseno, Resena } from "@/lib/resenas";
import { Star, Loader2, Check } from "lucide-react";

export default function ResenasLocal({ localId, nombre }: { localId: string; nombre: string }) {
  const { user } = useAuth();
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [reseño, setReseño] = useState(false); // ya reseñó
  const [puntos, setPuntos] = useState(0);
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");

  useEffect(() => {
    getResenasAprobadas("local", localId).then((r) => { setResenas(r); setCargando(false); });
    if (user) yaReseno(user.id, "local", localId).then(setReseño);
  }, [localId, user]);

  const media = resenas.length ? resenas.reduce((a, r) => a + r.puntuacion, 0) / resenas.length : 0;

  const enviar = async () => {
    if (!user || puntos === 0) return;
    setEstado("enviando");
    const { error } = await crearResena(user.id, "local", localId, puntos, comentario);
    if (error) setEstado("error");
    else { setEstado("enviado"); setReseño(true); }
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
      ) : reseño || estado === "enviado" ? (
        <div className="flex items-center gap-2 rounded-2xl bg-oro/10 p-4 text-sm font-bold text-tinta/80">
          <Check size={18} className="text-oro-600" /> ¡Gracias! Tu reseña está pendiente de aprobación.
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
