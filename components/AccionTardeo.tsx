"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tardeo } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { esFavorito, setFavorito, estaInscrito, inscribir, cancelarInscripcion } from "@/lib/tardeos";
import { Ticket, ListChecks, Check, Heart, ExternalLink, Loader2 } from "lucide-react";

export default function AccionTardeo({ tardeo }: { tardeo: Tardeo }) {
  const { user } = useAuth();
  const router = useRouter();
  const [apuntado, setApuntado] = useState(false);
  const [fav, setFav] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!user) { setFav(false); setApuntado(false); return; }
    esFavorito(user.id, tardeo.id).then(setFav);
    if (tardeo.tipoEntrada === "gratis") estaInscrito(user.id, tardeo.id).then(setApuntado);
  }, [user, tardeo.id, tardeo.tipoEntrada]);

  const pedirLogin = () => router.push("/perfil");

  const toggleFav = async () => {
    if (!user) return pedirLogin();
    const nuevo = !fav;
    setFav(nuevo);
    await setFavorito(user.id, tardeo.id, nuevo);
  };

  const toggleApuntar = async () => {
    if (!user) return pedirLogin();
    setOcupado(true);
    if (apuntado) { await cancelarInscripcion(user.id, tardeo.id); setApuntado(false); }
    else { await inscribir(user.id, tardeo.id); setApuntado(true); }
    setOcupado(false);
  };

  const irFourvenues = () => {
    alert("Te llevaríamos a Fourvenues para " + (tardeo.tipoEntrada === "lista" ? "apuntarte a la lista" : "comprar la entrada") + " (demo).");
  };

  return (
    <div className="fixed bottom-[68px] left-0 right-0 z-[900] border-t border-magenta-100 bg-white/95 backdrop-blur md:bottom-4 md:border-0 md:bg-transparent md:backdrop-blur-0">
      <div className="mx-auto flex max-w-md items-center gap-3 p-3 md:max-w-lg md:rounded-3xl md:border md:border-magenta-100 md:bg-white/95 md:shadow-tarjeta md:backdrop-blur">
        <button
          onClick={toggleFav}
          aria-label="Favorito"
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ring-2 transition ${
            fav ? "bg-magenta text-white ring-magenta" : "bg-white text-magenta ring-magenta-100"
          }`}
        >
          <Heart size={26} fill={fav ? "currentColor" : "none"} />
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
          <button
            onClick={irFourvenues}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white transition active:scale-[0.98]"
          >
            {tardeo.tipoEntrada === "lista" ? (<><ListChecks size={22} /> Apuntarme a la lista</>) : (<><Ticket size={22} /> Comprar entrada {tardeo.precio}€</>)}
            <ExternalLink size={16} className="opacity-70" />
          </button>
        )}
      </div>
    </div>
  );
}
