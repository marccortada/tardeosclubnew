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
      <span className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-tinta">
        <Music2 size={16} className="text-magenta" /> Playlist
      </span>
      <input
        type="url"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="https://open.spotify.com/playlist/… o SoundCloud"
        className="w-full rounded-xl border border-linea-fuerte bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta"
      />
      {reconocido === true && (
        <span className="mt-1 flex items-center gap-1.5 text-xs font-bold text-ok">
          <Check size={13} /> Se reproducirá dentro de tu ficha.
        </span>
      )}
      {reconocido === false && (
        <span className="mt-1 flex items-center gap-1.5 text-sm text-tinta-suave">
          <AlertTriangle size={13} /> No lo reconocemos: saldrá como enlace. Valen Spotify, SoundCloud, Mixcloud y YouTube.
        </span>
      )}
      {reconocido === null && (
        <span className="mt-1 block text-sm text-tinta-suave">
          Spotify, SoundCloud, Mixcloud o YouTube. Suena en tu ficha pública.
        </span>
      )}
    </label>
  );
}
