"use client";

import { urlIncrustada } from "@/lib/djs";
import { Music2, Check, AlertTriangle } from "lucide-react";

/**
 * Campo para pegar la playlist.
 *
 * Dice EN EL MOMENTO si el enlace se va a poder reproducir dentro de la ficha o
 * si saldrá como enlace suelto. Sin ese aviso, uno pega algo raro, guarda, y
 * descubre el resultado días después mirando su propia página.
 */
export default function CampoPlaylist({
  valor,
  onCambio,
}: {
  valor: string;
  onCambio: (v: string) => void;
}) {
  const u = valor.trim();
  const reconocido = u ? Boolean(urlIncrustada(u)) : null;

  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
        <Music2 size={16} className="text-magenta" /> Playlist
      </span>
      <input
        type="url"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="https://open.spotify.com/playlist/… o SoundCloud"
        className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta"
      />
      {reconocido === true && (
        <span className="mt-1 flex items-center gap-1.5 text-xs font-bold text-oro-600">
          <Check size={13} /> Se reproducirá dentro de tu ficha.
        </span>
      )}
      {reconocido === false && (
        <span className="mt-1 flex items-center gap-1.5 text-xs font-bold text-tinta/55">
          <AlertTriangle size={13} /> No lo reconocemos: saldrá como enlace. Valen Spotify, SoundCloud, Mixcloud y YouTube.
        </span>
      )}
      {reconocido === null && (
        <span className="mt-1 block text-xs font-semibold text-tinta/50">
          Spotify, SoundCloud, Mixcloud o YouTube. Suena en tu ficha pública.
        </span>
      )}
    </label>
  );
}
