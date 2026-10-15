"use client";

import { useEffect, useState } from "react";
import { claseCampo } from "@/components/ui/Campo";
import { claseBoton } from "@/components/Boton";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getResenasAprobadas, crearResena, miResena, apelarResena, etiquetaMotivo, Resena } from "@/lib/resenas";
import { Star, Loader2, Check, Ban, Clock } from "lucide-react";

export default function Resenas({
  tipo,
  objetivoId,
  nombre,
  className = "mt-8",
  tardeo,
}: {
  tipo: "local" | "dj";
  objetivoId: string;
  nombre: string;
  /** Margen superior. Las fichas nuevas espacian con `gap` y pasan "". */
  className?: string;
  /**
   * Desde la ficha de un tardeo: su título (por si el local viene sin nombre)
   * y si ya terminó. Antes de que acabe no se puede valorar: aún no lo ha
   * vivido nadie.
   */
  tardeo?: { titulo: string; terminado: boolean };
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

  // Nunca "¿Qué tal ?": si falta el nombre, el del tardeo o un texto sin nombre.
  const quien = nombre?.trim() || tardeo?.titulo?.trim() || "";
  const esperarAlFinal = !!tardeo && !tardeo.terminado;

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
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[24px] font-bold leading-tight md:text-[30px]">Reseñas</h2>
        {resenas.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-marfil-100 px-3 py-1 text-[15px] font-bold text-tinta">
            <Star size={14} className="text-oro" fill="currentColor" aria-hidden /> {media.toFixed(1)} · {resenas.length}
          </span>
        )}
      </div>

      {/* Formulario de valoración */}
      {esperarAlFinal && !mia ? (
        <p className="flex items-center gap-2 rounded-2xl border border-linea bg-white p-4 text-[15px] font-semibold text-tinta-suave">
          <Clock size={18} className="shrink-0 text-magenta" aria-hidden /> Podrás valorarlo cuando termine.
        </p>
      ) : !user ? (
        <Link href="/perfil" className={claseBoton("contorno", "normal", true)}>
          {quien ? `Entra para valorar ${quien}` : "Entra para valorar"}
        </Link>
      ) : mia?.estado === "rechazada" ? (
        /*
          Que se entere de que se la han rechazado, y de por qué.
          Antes desaparecía sin más: quien la escribía volvía a la ficha, no
          veía su reseña, y no tenía forma de saber si se había perdido, si
          seguía en cola o si alguien había decidido algo. Eso es lo que
          convierte una moderación normal en un agravio.
        */
        <div className="rounded-2xl border border-linea bg-white p-4">
          <p className="flex items-center gap-2 font-bold">
            <Ban size={17} className="shrink-0 text-magenta" /> No publicamos tu reseña
          </p>
          <p className="mt-1 text-[15px] text-tinta-suave">
            Motivo: <b>{etiquetaMotivo(mia.motivo_rechazo).toLowerCase()}</b>.
            Si crees que nos hemos equivocado, dínoslo y la vuelve a mirar una persona.
          </p>
          <textarea
            value={apelacion} onChange={(e) => setApelacion(e.target.value)} rows={2} maxLength={500}
            placeholder="Por qué crees que hay un error…"
            className={`mt-2 ${claseCampo}`}
          />
          {errorApel && <p role="alert" className="mt-1 text-[15px] font-semibold text-error">{errorApel}</p>}
          <button
            onClick={async () => {
              setApelando(true); setErrorApel("");
              const r = await apelarResena(mia.id, apelacion);
              setApelando(false);
              if (!r.ok) { setErrorApel(r.error ?? "No se pudo enviar."); return; }
              setMia({ ...mia, estado: "apelada", apelacion });
            }}
            disabled={apelando || !apelacion.trim()}
            className={claseBoton("contorno", "pequeno", true, "mt-2")}
          >
            {apelando ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />} Pedir que la revisen
          </button>
        </div>
      ) : mia?.estado === "apelada" ? (
        <div className="flex items-start gap-2 rounded-2xl bg-ok-fondo p-4 text-[15px] font-semibold text-tinta">
          <Check size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden />
          Gracias. La vuelve a mirar una persona y te decimos algo.
        </div>
      ) : mia || estado === "enviado" ? (
        <div className="flex items-center gap-2 rounded-2xl bg-ok-fondo p-4 text-[15px] font-semibold text-tinta">
          <Check size={18} className="shrink-0 text-ok" aria-hidden />
          {mia?.estado === "aprobada"
            ? "Tu reseña está publicada. ¡Gracias!"
            : "¡Gracias! Tu reseña está pendiente de aprobación."}
        </div>
      ) : (
        <div className="rounded-2xl border border-linea bg-white p-4">
          <p className="mb-2 text-[15px] font-semibold text-tinta-suave">{quien ? `¿Qué tal ${quien}?` : "¿Qué tal la experiencia?"}</p>
          <div className={`flex gap-1 ${puntos > 0 ? "mb-3" : ""}`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setPuntos(n)} aria-label={`${n} estrellas`} aria-pressed={n === puntos} className="grid h-12 w-12 place-items-center rounded-xl hover:bg-marfil-100">
                <Star size={32} className={n <= puntos ? "text-oro" : "text-linea-fuerte"} fill={n <= puntos ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          {/* El comentario y el botón salen al tocar una estrella: con las
              estrellas solas la ficha pesa mucho menos, y quien no va a
              valorar no ve un formulario entero. */}
          {puntos > 0 && (
            <>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Cuenta tu experiencia (opcional)…"
                className={claseCampo} />
              {estado === "error" && <p role="alert" className="mt-1 text-[15px] font-semibold text-error">No se pudo enviar. ¿Ya la habías dejado?</p>}
              <button onClick={enviar} disabled={estado === "enviando"}
                className={claseBoton("primario", "normal", true, "mt-3")}>
                {estado === "enviando" ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} />} Enviar reseña
              </button>
            </>
          )}
        </div>
      )}

      {/* Lista de reseñas aprobadas */}
      {cargando ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-tinta-suave"><Loader2 size={16} className="animate-spin" /> Cargando reseñas…</div>
      ) : resenas.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {resenas.map((r) => (
            <div key={r.id} className="rounded-2xl border border-linea bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold">{r.profiles?.display_name || "Tardícola"}</p>
                <span className="inline-flex items-center gap-0.5 text-[15px] font-bold text-tinta">
                  {r.puntuacion} <Star size={14} className="text-oro" fill="currentColor" aria-hidden />
                </span>
              </div>
              {r.comentario && <p className="mt-1 text-[15px] text-tinta">{r.comentario}</p>}
            </div>
          ))}
        </div>
      ) : null /* Sin reseñas no se dice nada: las estrellas ya invitan a dejar la primera. */}
    </section>
  );
}
