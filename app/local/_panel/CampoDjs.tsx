"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Disc3 } from "lucide-react";
import Campo from "@/components/ui/Campo";
import { useDiferido } from "@/components/panel/Paginacion";
import { buscarDjsDirectorio, type DjDirectorio } from "@/lib/tardeos";

/** Separadores que entiende vincularDjsPorNombre: «·», comas, «&» y « y ». */
const SEPARADOR = /[,·&]|\sy\s/i;

/**
 * El campo DJ con sugerencias del directorio.
 *
 * Sigue siendo texto libre —un DJ sin ficha se escribe igual—, pero al teclear
 * salen los DJs fichados que encajan y, al elegir uno, se escribe su nombre
 * EXACTO. Es lo que hace que el tardeo acabe en su perfil: con el nombre a
 * mano («Dj Taño» contra «DJ Tano») a veces no casaba y nadie se enteraba.
 *
 * Solo se busca el último nombre de la lista (lo que se está escribiendo).
 */
export default function CampoDjs({
  valor, onCambio, clase, ayuda,
}: { valor: string; onCambio: (v: string) => void; clase: string; ayuda?: string }) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<DjDirectorio[]>([]);
  const [activo, setActivo] = useState(-1);
  const caja = useRef<HTMLDivElement>(null);

  const partes = valor.split(SEPARADOR);
  const ultimo = (partes[partes.length - 1] ?? "").trim();
  const buscado = useDiferido(ultimo, 250);

  useEffect(() => {
    let vivo = true;
    if (buscado.length < 2) { setSugerencias([]); return; }
    buscarDjsDirectorio(buscado).then((r) => {
      if (!vivo) return;
      // Fuera los que ya están escritos tal cual.
      const ya = new Set(partes.slice(0, -1).map((p) => p.trim().toLowerCase()));
      setSugerencias(r.filter((d) => !ya.has(d.nombre_artistico.toLowerCase())));
      setActivo(-1);
    });
    return () => { vivo = false; };
  }, [buscado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar al tocar fuera.
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const elegir = (d: DjDirectorio) => {
    const previos = partes.slice(0, -1).map((p) => p.trim()).filter(Boolean);
    onCambio([...previos, d.nombre_artistico].join(" · ") + " · ");
    setSugerencias([]);
    setAbierto(false);
  };

  const visible = abierto && sugerencias.length > 0;

  return (
    <div ref={caja} className="relative">
      <Campo etiqueta="DJ (opcional)" htmlFor={id}
        ayuda={ayuda ?? "Empieza a escribir y elige del directorio para que salga en su perfil. Si son varios, sepáralos con «·»."}>
        <input
          id={id}
          value={valor}
          autoComplete="off"
          role="combobox"
          aria-expanded={visible}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          onChange={(e) => { onCambio(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (!visible) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, sugerencias.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && activo >= 0) { e.preventDefault(); elegir(sugerencias[activo]); }
            else if (e.key === "Escape") setAbierto(false);
          }}
          placeholder="DJ Nando · DJ Kiko"
          className={clase}
        />
      </Campo>
      {visible && (
        <ul id={`${id}-lista`} role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-linea bg-white shadow-elevada">
          {sugerencias.map((d, i) => (
            <li key={d.id} role="option" aria-selected={i === activo}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(d)}
                className={`flex min-h-[48px] w-full items-center gap-3 px-3 text-left text-[16px] ${i === activo ? "bg-magenta-50" : "hover:bg-marfil-100"}`}>
                {d.avatar_url
                  ? <Image src={d.avatar_url} alt="" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
                  : <span className="grid h-8 w-8 place-items-center rounded-full bg-magenta-50 text-magenta"><Disc3 size={16} aria-hidden /></span>}
                <span className="flex-1 font-semibold">{d.nombre_artistico}</span>
                {d.verificado && <BadgeCheck size={16} className="text-magenta" aria-label="Verificado" />}
              </button>
            </li>
          ))}
          <li className="border-t border-linea px-3 py-2 text-[13px] text-tinta-suave">Del directorio de DJs de TardeosClub</li>
        </ul>
      )}
    </div>
  );
}
