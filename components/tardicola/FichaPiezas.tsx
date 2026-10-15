"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import type { Tardeo } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { getAdn } from "@/lib/tardicola";
import { encajeDe } from "@/lib/recomendar";

/** "Afín a mí": solo si algún criterio real del ADN coincide (sin porcentajes). */
export function AfinAMi({ tardeo }: { tardeo: Tardeo }) {
  const { user } = useAuth();
  const [afin, setAfin] = useState(false);
  useEffect(() => {
    if (!user) return;
    getAdn(user.id).then((a) => setAfin(Boolean(a) && encajeDe(tardeo, a).motivos.length > 0));
  }, [user, tardeo]);
  if (!afin) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-magenta-50 px-2.5 py-1 text-[14px] font-bold text-magenta-700">
      <Heart size={13} fill="currentColor" aria-hidden /> Afín a mí
    </span>
  );
}

/** Descripción breve con "Leer más" (dossier pág. 5). */
export function LeerMas({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  const largo = texto.length > 180;
  return (
    <p className="whitespace-pre-line text-[16px] leading-relaxed text-tinta">
      {abierto || !largo ? texto : `${texto.slice(0, 170).trimEnd()}… `}
      {largo && (
        <button type="button" onClick={() => setAbierto((v) => !v)} className="-my-2 inline-flex min-h-[44px] items-center font-semibold text-magenta-700">
          {abierto ? " Leer menos" : "Leer más"}
        </button>
      )}
    </p>
  );
}
