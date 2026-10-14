"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tardeo } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { esFavorito, setFavorito, estaInscrito, inscribir, cancelarInscripcion } from "@/lib/tardeos";
import { flyerSrc, formatFecha } from "@/lib/formato";
import { medir } from "@/lib/metricas";
import { X, Heart, Check, Loader2, Ticket, ListChecks, MapPin, Clock, ArrowRight, BadgeCheck } from "lucide-react";
import { claseBoton } from "@/components/Boton";

/**
 * La hoja que sale al tocar una chincheta del mapa: flyer, cuándo, dónde y la
 * acción principal. Favorito e inscripción se comprueban contra la base: si
 * no se guardan, se dice y se deshace (antes la pantalla mentía).
 */
export default function MapaSheet({ tardeo, onClose }: { tardeo: Tardeo; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [fav, setFav] = useState(false);
  const [apuntado, setApuntado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const cerrarRef = useRef(onClose);
  useEffect(() => { cerrarRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!user) { setFav(false); setApuntado(false); return; }
    esFavorito(user.id, tardeo.id).then(setFav);
    if (tardeo.tipoEntrada === "gratis") estaInscrito(user.id, tardeo.id).then(setApuntado);
  }, [user, tardeo.id, tardeo.tipoEntrada]);

  // Escape cierra, como cualquier diálogo.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrarRef.current(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // Navegación del router y no `window.location`: no recarga la app entera.
  const pedirLogin = () => router.push("/perfil");

  const toggleFav = async () => {
    if (!user) { pedirLogin(); return; }
    const n = !fav;
    setFav(n); setAviso("");
    const { error } = await setFavorito(user.id, tardeo.id, n);
    if (error) { setFav(!n); setAviso("No se pudo guardar. Inténtalo otra vez."); return; }
    if (n) medir("favorito", { tardeoId: tardeo.id });
  };

  const toggleApuntar = async () => {
    if (!user) { pedirLogin(); return; }
    setOcupado(true); setAviso("");
    if (apuntado) {
      const { error } = await cancelarInscripcion(user.id, tardeo.id);
      if (error) setAviso("No se pudo cancelar tu plaza. Inténtalo otra vez.");
      else setApuntado(false);
    } else {
      const { error } = await inscribir(user.id, tardeo.id);
      if (error?.message === "AFORO_COMPLETO") setAviso("Se han acabado las plazas de este tardeo.");
      else if (error) setAviso("No te hemos podido apuntar. Inténtalo otra vez.");
      else { setApuntado(true); medir("inscripcion", { tardeoId: tardeo.id }); }
    }
    setOcupado(false);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-tinta/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tardeo.titulo}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-elevada sm:rounded-2xl"
      >
        {/* El asa: en el móvil dice "esto es una hoja" sin tener que leer nada. */}
        <div className="absolute left-1/2 top-2 z-10 h-1.5 w-11 -translate-x-1/2 rounded-full bg-white/80 sm:hidden" aria-hidden />
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-tinta shadow-tarjeta transition hover:bg-marfil-100"
        >
          <X size={20} aria-hidden />
        </button>

        {/* El flyer entero (contain) sobre una copia suya difuminada: sin
            franjas grises a los lados cuando no es vertical. */}
        <div className="relative h-[38dvh] max-h-[360px] min-h-[200px] w-full overflow-hidden bg-tinta">
          <Image src={flyerSrc(tardeo)} alt="" fill sizes="420px" aria-hidden className="scale-110 object-cover opacity-60 blur-2xl" />
          <Image src={flyerSrc(tardeo)} alt={`Flyer de ${tardeo.titulo}`} fill sizes="(max-width: 640px) 100vw, 420px" className="object-contain" />
        </div>

        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="text-[15px] font-bold text-magenta-700">{formatFecha(tardeo.fecha)}</p>
          <h3 className="mt-1 font-display text-[24px] font-bold leading-tight">{tardeo.titulo}</h3>
          <div className="mt-2 flex flex-col gap-1.5 text-[16px] font-medium text-tinta-suave">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={16} className="shrink-0" aria-hidden />
              {[tardeo.local.nombre, tardeo.zona].filter(Boolean).join(" · ")}
              {tardeo.local.verificado && <BadgeCheck size={15} className="text-magenta" aria-label="Verificado" />}
            </span>
            {tardeo.horaInicio && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} className="shrink-0" aria-hidden /> {tardeo.horaInicio}{tardeo.horaFin ? `–${tardeo.horaFin}` : ""}
              </span>
            )}
          </div>

          {aviso && <p role="alert" className="mt-3 rounded-xl bg-error-fondo px-3 py-2 text-[15px] font-semibold text-error">{aviso}</p>}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={toggleFav}
              aria-label={fav ? "Quitar de mis planes" : "Guardar en mis planes"}
              aria-pressed={fav}
              className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border transition ${
                fav ? "border-magenta bg-magenta text-white" : "border-linea-fuerte bg-white text-magenta"
              }`}
            >
              <Heart size={24} fill={fav ? "currentColor" : "none"} aria-hidden />
            </button>

            {tardeo.tipoEntrada === "gratis" ? (
              <button
                onClick={toggleApuntar}
                disabled={ocupado}
                className={claseBoton("oro", "normal", true, `flex-1 ${apuntado ? "!bg-ok !text-white" : ""}`)}
              >
                {ocupado ? <Loader2 size={22} className="animate-spin" aria-hidden /> : apuntado ? (<><Check size={22} aria-hidden /> Apuntado</>) : "Apuntarme"}
              </button>
            ) : (
              <Link href={`/tardeos/${tardeo.id}`} className={claseBoton("oro", "normal", true, "flex-1")}>
                {tardeo.tipoEntrada === "lista"
                  ? (<><ListChecks size={22} aria-hidden /> Apuntarme a la lista</>)
                  : (<><Ticket size={22} aria-hidden /> Entradas{tardeo.precio ? ` · ${tardeo.precio} €` : ""}</>)}
              </Link>
            )}
          </div>

          <Link href={`/tardeos/${tardeo.id}`} className="mt-2 flex min-h-tacto items-center justify-center gap-1 text-[15px] font-bold text-magenta-700">
            Ver todos los detalles <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
