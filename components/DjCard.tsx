import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";

export default function DjCard({ dj }: { dj: any }) {
  const estilos: string[] = Array.isArray(dj.estilos) ? dj.estilos : [];
  const inicial = String(dj.nombre_artistico || "DJ").replace("DJ ", "").charAt(0);

  return (
    <Link
      href={`/djs/${dj.id}`}
      className="flex flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {dj.avatar_url ? (
        <Image src={dj.avatar_url} alt="" width={80} height={80} className="h-20 w-20 rounded-full object-cover ring-2 ring-magenta-100" />
      ) : (
        <span className="grid h-20 w-20 place-items-center rounded-full bg-marca font-display text-3xl font-black text-white">{inicial}</span>
      )}
      <p className="inline-flex items-center gap-1 font-black leading-tight">
        {dj.nombre_artistico}
        {dj.verificado && <BadgeCheck size={15} className="shrink-0 text-oro-600" />}
      </p>
      <span className="inline-flex items-center gap-1 rounded-full bg-oro/15 px-2.5 py-0.5 text-sm font-black text-oro-600">
        <Star size={13} fill="currentColor" /> {Number(dj.reputacion_score ?? 0).toFixed(1)}
      </span>
      {estilos.length > 0 && (
        <p className="line-clamp-1 text-xs font-semibold text-tinta/60">{estilos.join(" · ")}</p>
      )}
    </Link>
  );
}
