"use client";
import Image from "next/image";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tardeo } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { esFavorito, setFavorito, estaInscrito, inscribir, cancelarInscripcion } from "@/lib/tardeos";
import { flyerSrc, formatFecha } from "@/lib/mockData";
import { X, Heart, Check, Loader2, Ticket, ListChecks, MapPin, Clock, ArrowRight, BadgeCheck } from "lucide-react";

export default function MapaSheet({ tardeo, onClose }: { tardeo: Tardeo; onClose: () => void }) {
  const { user } = useAuth();
  const [fav, setFav] = useState(false);
  const [apuntado, setApuntado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!user) { setFav(false); setApuntado(false); return; }
    esFavorito(user.id, tardeo.id).then(setFav);
    if (tardeo.tipoEntrada === "gratis") estaInscrito(user.id, tardeo.id).then(setApuntado);
  }, [user, tardeo.id, tardeo.tipoEntrada]);

  const toggleFav = async () => {
    if (!user) { window.location.href = "/perfil"; return; }
    const n = !fav; setFav(n); await setFavorito(user.id, tardeo.id, n);
  };

  const toggleApuntar = async () => {
    if (!user) { window.location.href = "/perfil"; return; }
    setOcupado(true);
    if (apuntado) { await cancelarInscripcion(user.id, tardeo.id); setApuntado(false); }
    else { await inscribir(user.id, tardeo.id); setApuntado(true); }
    setOcupado(false);
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
        >
          <X size={18} />
        </button>

        {/* Flyer */}
        <div className="relative aspect-[4/5] max-h-[42vh] w-full overflow-hidden bg-tinta">
          <Image src={flyerSrc(tardeo)} alt={tardeo.titulo} fill sizes="(max-width: 640px) 100vw, 420px" className="object-contain" />
        </div>

        {/* Detalles */}
        <div className="p-5">
          <p className="font-script text-lg leading-none text-magenta-600">{formatFecha(tardeo.fecha)}</p>
          <h3 className="font-display text-2xl font-black leading-tight">{tardeo.titulo}</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-tinta/60">
            <span className="inline-flex items-center gap-1">
              <MapPin size={15} className="text-magenta" /> {tardeo.local.nombre}
              {tardeo.local.verificado && <BadgeCheck size={14} className="text-oro-600" />} · {tardeo.zona}
            </span>
            {tardeo.horaInicio && (
              <span className="inline-flex items-center gap-1">
                <Clock size={15} className="text-magenta" /> {tardeo.horaInicio}{tardeo.horaFin ? `–${tardeo.horaFin}` : ""}
              </span>
            )}
          </div>

          {/* Acciones */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={toggleFav}
              aria-label="Favorito"
              className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl ring-2 transition ${
                fav ? "bg-magenta text-white ring-magenta" : "bg-white text-magenta ring-magenta-100"
              }`}
            >
              <Heart size={24} fill={fav ? "currentColor" : "none"} />
            </button>

            {tardeo.tipoEntrada === "gratis" ? (
              <button
                onClick={toggleApuntar}
                disabled={ocupado}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60 ${
                  apuntado ? "bg-oro-600" : "bg-magenta"
                }`}
              >
                {ocupado ? <Loader2 size={22} className="animate-spin" /> : apuntado ? (<><Check size={22} /> ¡Apuntado!</>) : "Apuntarme"}
              </button>
            ) : (
              <Link
                href={`/tardeos/${tardeo.id}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white transition active:scale-[0.98]"
              >
                {tardeo.tipoEntrada === "lista" ? (<><ListChecks size={22} /> Apuntarme a la lista</>) : (<><Ticket size={22} /> Entrada {tardeo.precio}€</>)}
              </Link>
            )}
          </div>

          <Link href={`/tardeos/${tardeo.id}`} className="mt-3 flex items-center justify-center gap-1 text-sm font-extrabold text-magenta">
            Ver todos los detalles <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
