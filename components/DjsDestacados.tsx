import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Star, Disc3, ArrowRight } from "lucide-react";

export default function DjsDestacados({ djs }: { djs: any[] }) {
  if (!djs || djs.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 md:px-8">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="flex items-center gap-2 font-display text-2xl font-black md:text-3xl">
          DJs destacados <Disc3 size={22} className="text-magenta" />
        </h2>
        <Link href="/djs" className="inline-flex items-center gap-1 text-sm font-extrabold text-magenta">
          Ver todos <ArrowRight size={16} />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {djs.map((dj) => {
          const inicial = String(dj.nombre_artistico || "DJ").replace("DJ ", "").charAt(0);
          return (
            <Link
              key={dj.id}
              href={`/djs/${dj.id}`}
              className="flex w-28 shrink-0 flex-col items-center gap-1.5 rounded-3xl bg-white p-3 text-center shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {dj.avatar_url ? (
                <Image src={dj.avatar_url} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover ring-2 ring-magenta-100" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full bg-marca font-display text-2xl font-black text-white">{inicial}</span>
              )}
              <p className="inline-flex items-center gap-0.5 text-sm font-black leading-tight line-clamp-1">
                {dj.nombre_artistico}
                {dj.verificado && <BadgeCheck size={13} className="shrink-0 text-oro-600" />}
              </p>
              <span className="inline-flex items-center gap-0.5 text-xs font-black text-oro-600">
                <Star size={11} fill="currentColor" /> {Number(dj.reputacion_score ?? 0).toFixed(1)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
