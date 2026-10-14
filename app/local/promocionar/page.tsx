"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { ContactoDestacar } from "@/components/PromocionModal";
import PromocionModal from "@/components/PromocionModal";
import { claseBoton } from "@/components/Boton";
import { Etiqueta } from "@/components/ui/Chip";
import { useFicha } from "../_panel/PanelLocal";
import { getTardeosDeLocal } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import type { Tardeo } from "@/lib/types";

/**
 * Promocionar: qué es un destacado y cómo pedirlo, tardeo a tardeo.
 *
 * Sin pasarela de pago a propósito: los cobros están apagados. El botón abre
 * WhatsApp (o email) con TardeosClub con el nombre del tardeo ya escrito.
 */
export default function Promocionar() {
  const { ficha, enlace } = useFicha();
  const [proximos, setProximos] = useState<Tardeo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getTardeosDeLocal(ficha.id, "proximos", 0, 9).then((r) => {
      if (!vivo) return;
      setProximos(r.data ?? []);
      setError(r.error?.message ?? null);
    });
    return () => { vivo = false; };
  }, [ficha.id]);

  return (
    <SeccionPanel titulo="Promocionar" descripcion="Haz que un tardeo salga destacado en la portada.">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <h2 className="mb-3 text-xl font-bold">Elige qué tardeo destacar</h2>
          {proximos === null ? (
            <div className="flex flex-col gap-2" aria-busy>
              {[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
            </div>
          ) : error ? (
            <p className="rounded-xl border border-error/20 bg-error-fondo p-4 text-[15px] font-semibold text-error">No se pudieron cargar: {error}</p>
          ) : proximos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center">
              <p className="text-[15px] text-tinta-suave">No tienes tardeos próximos publicados. Crea uno y podrás destacarlo.</p>
              <Link href={enlace("/local/crear")} className={claseBoton("primario", "normal", false, "mt-3")}>Crear tardeo</Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {proximos.map((t) => (
                <li key={t.id} className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-tinta-suave">{formatFecha(t.fecha)}</p>
                    <p className="truncate text-[16px] font-bold">{t.titulo}</p>
                    {t.destacado && <Etiqueta tono="aviso"><Star size={13} aria-hidden /> Ya está destacado</Etiqueta>}
                  </div>
                  {!t.destacado && (
                    <div className="sm:w-60"><PromocionModal variante="boton" titulo={t.titulo} /></div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
          <h2 className="mb-3 text-lg font-bold">Qué incluye un destacado</h2>
          <ContactoDestacar />
        </aside>
      </div>
    </SeccionPanel>
  );
}
