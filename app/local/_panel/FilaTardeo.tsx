"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Pencil, ExternalLink, Users, Copy } from "lucide-react";
import type { Tardeo } from "@/lib/types";
import { flyerSrc, formatFecha } from "@/lib/formato";
import { Etiqueta } from "@/components/ui/Chip";
import { NOMBRE_ESTADO } from "@/components/CalendarioLocal";

/**
 * Una fila de tardeo en el panel: miniatura, fecha, título, estado y acciones.
 *
 * Un programado enseña CUÁNDO sale, no solo que no está publicado. Sin la
 * hora, el local ve "no publicado" en algo que sí va a salir y le entra la
 * duda de si lo hizo bien.
 */
export default function FilaTardeo({ t, enlace }: { t: Tardeo; enlace: (r: string) => string }) {
  // Un programado cuya hora ya pasó ya se ve en la web (la consulta pública
  // lo trata como publicado): decir «Sale el…» con una fecha pasada confunde.
  // La hora se fija al montar (el render debe ser puro).
  const [ahora] = useState(() => Date.now());
  const yaSalio = t.estado === "programado" && !!t.publicarEn && new Date(t.publicarEn).getTime() <= ahora;
  const e = NOMBRE_ESTADO[yaSalio ? "publicado" : t.estado ?? "publicado"] ?? NOMBRE_ESTADO.borrador;
  const programado = t.estado === "programado" && !yaSalio;
  const sale = programado && t.publicarEn
    ? new Date(t.publicarEn).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-3 shadow-tarjeta sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Miniatura de 56 px: antes se bajaba el flyer entero. */}
        <Image src={flyerSrc(t)} alt="" width={56} height={70} className="h-[70px] w-14 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-tinta-suave">
            {formatFecha(t.fecha)}{t.horaInicio ? ` · ${t.horaInicio.slice(0, 5)}` : ""}
          </p>
          <h3 className="truncate text-[16px] font-bold leading-tight">{t.titulo}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <Etiqueta tono={e.tono}>{programado && sale ? `Sale el ${sale}` : e.label}</Etiqueta>
            {t.destacado && <Etiqueta tono="aviso">Destacado</Etiqueta>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={enlace(`/local/tardeos/${t.id}/editar`)}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-magenta-50 px-4 text-[15px] font-bold text-magenta-700 hover:bg-magenta-100 sm:flex-none">
          <Pencil size={16} aria-hidden /> Editar
        </Link>
        {/* Duplicar: el mismo tardeo en otra fecha sin volver a escribirlo. */}
        <Link href={enlace(`/local/crear?desde=${t.id}`)} aria-label={`Duplicar ${t.titulo}`} title="Duplicar en otra fecha"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-linea-fuerte px-3 text-tinta hover:bg-marfil-100">
          <Copy size={18} aria-hidden />
        </Link>
        {t.tipoEntrada === "gratis" && (
          <Link href={enlace(`/local/apuntados?tardeo=${t.id}`)} aria-label={`Asistentes de ${t.titulo}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-linea-fuerte px-3 text-tinta hover:bg-marfil-100">
            <Users size={18} aria-hidden />
          </Link>
        )}
        {t.estado === "publicado" && (
          <Link href={`/tardeos/${t.id}`} target="_blank" aria-label={`Ver ${t.titulo} en la web`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-linea-fuerte px-3 text-tinta hover:bg-marfil-100">
            <ExternalLink size={18} aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}
