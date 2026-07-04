"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getMiLocal } from "@/lib/tardeos";
import PromocionModal from "@/components/PromocionModal";
import { Pencil } from "lucide-react";

/** Si el usuario logueado es el dueño del local de este tardeo, muestra
 *  las acciones de dueño: destacar (promoción) y editar. */
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

  useEffect(() => {
    if (!user) { setEsDueno(false); return; }
    getMiLocal(user.id).then((l) => setEsDueno(!!l && l.id === localId));
  }, [user, localId]);

  if (!esDueno) return null;

  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
      <p className="mb-3 flex items-center gap-2 text-sm font-black text-tinta/60">Tu tardeo · acciones de local</p>
      <div className="flex flex-col gap-2">
        <PromocionModal variante="boton" titulo={titulo} />
        <Link
          href={`/local/tardeos/${tardeoId}/editar`}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-extrabold text-magenta ring-1 ring-magenta-100 transition hover:bg-magenta-50"
        >
          <Pencil size={18} /> Editar tardeo
        </Link>
      </div>
    </section>
  );
}
