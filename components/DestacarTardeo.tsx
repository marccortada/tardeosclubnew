"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getMisLocales } from "@/lib/tardeos";
import PromocionModal from "@/components/PromocionModal";
import { Pencil } from "lucide-react";

/** Si el usuario logueado es el dueño del local de este tardeo, muestra
 *  las acciones de dueño: destacar (promoción) y editar.
 *
 *  Mira TODAS sus fichas, no solo la primera: quien tiene un local y además
 *  organiza como promotor no veía estas acciones en los tardeos de la segunda. */
export default function DestacarTardeo({
  localId,
  tardeoId,
  titulo,
}: {
  localId: string;
  tardeoId: string;
  titulo: string;
}) {
  const { user } = useAuth();
  const [esDueno, setEsDueno] = useState(false);
  const [varias, setVarias] = useState(false);

  useEffect(() => {
    if (!user) { setEsDueno(false); return; }
    getMisLocales(user.id).then(({ fichas }) => {
      setEsDueno(fichas.some((f) => f.id === localId));
      setVarias(fichas.length > 1);
    });
  }, [user, localId]);

  if (!esDueno) return null;

  return (
    <section className="mt-6 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
      <p className="mb-3 text-[15px] font-semibold text-tinta-suave">Es tu tardeo</p>
      <div className="flex flex-col gap-2">
        <PromocionModal variante="boton" titulo={titulo} />
        <Link
          href={`/local/tardeos/${tardeoId}/editar${varias ? `?id=${localId}` : ""}`}
          className="flex min-h-tacto items-center justify-center gap-2 rounded-xl border border-linea-fuerte bg-white text-[17px] font-bold text-tinta hover:bg-marfil-100"
        >
          <Pencil size={18} aria-hidden /> Editar tardeo
        </Link>
      </div>
    </section>
  );
}
