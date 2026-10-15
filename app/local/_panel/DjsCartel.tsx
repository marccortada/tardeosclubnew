"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Disc3, Plus, X, Loader2, UserPlus } from "lucide-react";
import { useDiferido } from "@/components/panel/Paginacion";
import { buscarDjsDirectorio, crearDjProvisional, type DjDirectorio } from "@/lib/tardeos";

/** Separadores que entiende vincularDjsPorNombre / setDjsDeTardeo. */
const SEPARADOR = /[,·&]|\sy\s/i;

/**
 * DJs del cartel como CHIPS vinculados a fichas reales (dossier pág. 11 y
 * vídeo): «Marta Sol · Diego Velaz · + Añadir DJ».
 *
 * El valor sigue siendo el texto «A · B» que ya entienden el alta y el editor
 * (vincularDjsPorNombre / setDjsDeTardeo), así no cambia cómo se guarda. Lo
 * nuevo: cada chip es un DJ del directorio con su nombre EXACTO, y si no
 * existe se crea su ficha PROVISIONAL (lote 68) para que el tardeo salga en su
 * perfil y el equipo la revise. El organizador añade sus DJs directamente; la
 * invitación (para que el DJ confirme) sigue en el editor del tardeo.
 */
export default function DjsCartel({ valor, onCambio, revisar }: { valor: string; onCambio: (v: string) => void; revisar?: boolean }) {
  const id = useId();
  const nombres = valor.split(SEPARADOR).map((n) => n.trim()).filter(Boolean);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<DjDirectorio[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const buscado = useDiferido(texto.trim(), 250);

  useEffect(() => {
    let vivo = true;
    if (buscado.length < 2) { setSugerencias([]); return; }
    setBuscando(true);
    buscarDjsDirectorio(buscado, 8).then((r) => {
      if (!vivo) return;
      const ya = new Set(nombres.map((n) => n.toLowerCase()));
      setSugerencias(r.filter((d) => !ya.has(d.nombre_artistico.toLowerCase())));
      setBuscando(false);
    });
    return () => { vivo = false; };
  }, [buscado]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (abierto) entrada.current?.focus(); }, [abierto]);

  const poner = (lista: string[]) => onCambio(lista.join(" · "));
  const anadir = (nombre: string) => {
    if (!nombres.some((n) => n.toLowerCase() === nombre.toLowerCase())) poner([...nombres, nombre]);
    setTexto(""); setSugerencias([]); setAbierto(false); setError("");
  };
  const quitar = (nombre: string) => poner(nombres.filter((n) => n !== nombre));

  const crearNuevo = async () => {
    const n = texto.trim();
    if (n.length < 2) return;
    setCreando(true); setError("");
    const r = await crearDjProvisional(n);
    setCreando(false);
    // Aunque falle la ficha provisional, el nombre se queda en el cartel (como
    // antes): al publicar se avisará de que no tiene ficha.
    if (r.error) setError(r.error);
    anadir(n);
  };

  const exacto = sugerencias.some((d) => d.nombre_artistico.toLowerCase() === texto.trim().toLowerCase());

  return (
    <div>
      <p className="mb-1.5 text-[15px] font-semibold">DJs del cartel <span className="font-normal text-tinta-suave">(opcional)</span></p>
      <div className={`flex flex-wrap items-center gap-2 rounded-xl ${revisar ? "border border-aviso bg-aviso-fondo p-2" : ""}`}>
        {nombres.map((n) => (
          <span key={n} className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-magenta-50 pl-3.5 pr-1 text-[15px] font-semibold text-magenta-700">
            {n}
            <button type="button" onClick={() => quitar(n)} aria-label={`Quitar a ${n}`}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-magenta/10"><X size={16} aria-hidden /></button>
          </span>
        ))}
        {!abierto && (
          <button type="button" onClick={() => setAbierto(true)}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-linea-fuerte bg-white px-3.5 text-[15px] font-semibold text-tinta-suave hover:bg-marfil-100">
            <Plus size={16} aria-hidden /> Añadir DJ
          </button>
        )}
      </div>

      {abierto && (
        <div className="relative mt-2">
          <input
            ref={entrada} id={id} value={texto} autoComplete="off"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setAbierto(false); setTexto(""); }
              if (e.key === "Enter") { e.preventDefault(); if (sugerencias[0]) anadir(sugerencias[0].nombre_artistico); else void crearNuevo(); }
            }}
            placeholder="Busca por nombre artístico…"
            aria-label="Buscar DJ"
            className="min-h-[48px] w-full rounded-xl border border-linea-fuerte bg-white px-4 text-[16px] outline-none focus:border-magenta focus:ring-4 focus:ring-magenta/15"
          />
          <div className="mt-1 overflow-hidden rounded-xl border border-linea bg-white shadow-elevada">
            {buscando && <p className="flex items-center gap-2 px-3 py-2 text-[15px] text-tinta-suave"><Loader2 size={16} className="animate-spin" aria-hidden /> Buscando…</p>}
            <ul role="listbox" aria-label="DJs del directorio">
              {sugerencias.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => anadir(d.nombre_artistico)}
                    className="flex min-h-[48px] w-full items-center gap-3 px-3 text-left text-[16px] hover:bg-marfil-100">
                    {d.avatar_url
                      ? <Image src={d.avatar_url} alt="" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
                      : <span className="grid h-8 w-8 place-items-center rounded-full bg-magenta-50 text-magenta"><Disc3 size={16} aria-hidden /></span>}
                    <span className="flex-1 font-semibold">{d.nombre_artistico}</span>
                    {d.verificado && <BadgeCheck size={16} className="text-magenta" aria-label="Verificado" />}
                  </button>
                </li>
              ))}
            </ul>
            {texto.trim().length >= 2 && !buscando && !exacto && (
              <button type="button" onClick={crearNuevo} disabled={creando}
                className="flex min-h-[48px] w-full items-center gap-3 border-t border-linea px-3 text-left text-[15px] hover:bg-marfil-100">
                {creando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <UserPlus size={18} className="text-magenta" aria-hidden />}
                <span>No está: añadir «<b>{texto.trim()}</b>» como DJ nuevo <span className="text-tinta-suave">(lo revisamos)</span></span>
              </button>
            )}
            <button type="button" onClick={() => { setAbierto(false); setTexto(""); }}
              className="min-h-[44px] w-full border-t border-linea px-3 text-left text-[15px] font-semibold text-tinta-suave hover:bg-marfil-100">Cerrar</button>
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-sm text-aviso">{error}</p>}
      <p className="mt-1.5 text-sm text-tinta-suave">Salen en su perfil. Para que el DJ lo confirme, invítalo luego desde el tardeo.</p>
    </div>
  );
}
