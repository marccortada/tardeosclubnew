"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Heart } from "lucide-react";
import type { Tardeo } from "@/lib/types";
import { flyerSrc } from "@/lib/formato";
import { precioCorto } from "@/lib/tardicola";
import { useAuth } from "@/lib/useAuth";
import { esFavorito, setFavorito } from "@/lib/tardeos";
import { useRouter } from "next/navigation";

/** "SÁB 24 OCT · 17:00" */
export function fechaCorta(iso: string, hora?: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  const s = f.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .replace(/\./g, "").replace(",", "").toUpperCase();
  return hora ? `${s} · ${hora}` : s;
}

/**
 * Tarjeta de plan de la app (vídeo): foto, "Afín a mí", guardar, fecha, nombre,
 * precio en píldora y lugar. "Afín a mí" es binario y sale de una regla real
 * (algún criterio del ADN coincide): nada de porcentajes.
 */
export default function TarjetaPlan({ t, afin, patrocinado, href, distancia }: {
  t: Tardeo; afin?: boolean; patrocinado?: boolean; href?: string; distancia?: string | null;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [guardado, setGuardado] = useState(false);
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    esFavorito(user.id, t.id).then((v) => vivo && setGuardado(v));
    return () => { vivo = false; };
  }, [user, t.id]);

  const alternar = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) { router.push(`/perfil?volver=${encodeURIComponent(location.pathname + location.search)}`); return; }
    const n = !guardado;
    setGuardado(n);
    const { error } = await setFavorito(user.id, t.id, n);
    if (error) setGuardado(!n);
  };

  return (
    <Link href={href ?? `/tardeos/${t.id}`}
      className="block overflow-hidden rounded-3xl border border-linea bg-superficie shadow-tarjeta transition hover:shadow-elevada">
      <div className="relative aspect-[16/9] w-full bg-marfil-100">
        <Image src={flyerSrc(t)} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
        {afin && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-magenta-50 px-2.5 py-1 text-[13px] font-bold text-magenta-700">
            <Heart size={12} fill="currentColor" aria-hidden /> Afín a mí
          </span>
        )}
        <button type="button" onClick={alternar} aria-pressed={guardado} aria-label={guardado ? "Quitar de Próxima Parada" : "Guardar en Próxima Parada"}
          className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/45">
          <Bookmark size={20} fill={guardado ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold tracking-wide text-tinta-suave">{fechaCorta(t.fecha, t.horaInicio)}</p>
          {patrocinado && <span className="text-[12px] font-medium text-tinta-suave">Patrocinado</span>}
        </div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-[18px] font-bold leading-snug text-tinta">{t.titulo}</h3>
          <span className="shrink-0 rounded-lg bg-oro px-2.5 py-1 text-[14px] font-bold text-[#1A1A1A]">{precioCorto(t)}</span>
        </div>
        <p className="mt-1 truncate text-[15px] text-tinta-suave">
          {[t.local.nombre, t.zona].filter(Boolean).join(" · ")}{distancia ? ` · ${distancia}` : ""}
        </p>
      </div>
    </Link>
  );
}
