"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { COLS_SORTEO, etiquetaSorteo, fechaLarga, type Sorteo } from "@/lib/sorteos";
import { faltaLote } from "@/lib/encuestas";
import { CabeceraApp, Mensaje } from "@/components/retorno/Piezas";

/** Lista de sorteos visibles: abiertos primero, luego los que ya tienen ganador. */
export default function Sorteos() {
  const [lista, setLista] = useState<Sorteo[] | null>(null);
  const [falta, setFalta] = useState(false);

  useEffect(() => {
    supabase.from("sorteos").select(COLS_SORTEO).neq("estado", "borrador").order("cierra", { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (error) { setFalta(faltaLote(error)); setLista([]); return; }
        const ahora = Date.now();
        const s = (data ?? []) as Sorteo[];
        // Los que aún se pueden jugar, arriba.
        s.sort((a, b) => Number(new Date(b.cierra).getTime() > ahora) - Number(new Date(a.cierra).getTime() > ahora));
        setLista(s);
      });
  }, []);

  return (
    <div className="min-h-dvh bg-white pb-28">
      <CabeceraApp titulo="Sorteos" />
      <main className="mx-auto max-w-lg px-4 pt-4">
        {lista === null ? <p className="py-10 text-center text-tinta-suave">Cargando…</p>
          : falta ? <Mensaje icono={<Wrench size={26} aria-hidden />} titulo="Todavía no disponible"><p>Esta sección aún no está disponible.</p></Mensaje>
          : lista.length === 0 ? <Mensaje icono={<Gift size={26} aria-hidden />} titulo="No hay sorteos ahora"><p>Vuelve pronto: sorteamos entradas y planes.</p></Mensaje>
          : (
            <ul className="flex flex-col gap-4">
              {lista.map((s) => (
                <li key={s.id}>
                  <Link href={`/sorteos/${s.id}`} className="block overflow-hidden rounded-2xl border border-linea bg-white hover:shadow-tarjeta">
                    {s.imagen_url
                      // eslint-disable-next-line @next/next/no-img-element -- imagen de Storage o externa: sin dominio fijo para next/image
                      ? <img src={s.imagen_url} alt="" className="aspect-[16/9] w-full object-cover" />
                      : <div className="grid aspect-[16/9] w-full place-items-center bg-magenta-50 text-magenta"><Gift size={48} aria-hidden /></div>}
                    <div className="p-4">
                      <p className="text-[13px] font-semibold uppercase tracking-wide text-magenta">{etiquetaSorteo(s)}</p>
                      <h2 className="mt-1 text-[20px] font-bold leading-tight">{s.titulo}</h2>
                      <p className="mt-1 text-[15px] text-tinta-suave">{s.premio}</p>
                      <p className="mt-2 text-[14px] text-tinta-suave">
                        {s.estado === "resuelto" ? `Ganador: ${s.ganador_alias}` : `Cierra el ${fechaLarga(s.cierra)}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </main>
    </div>
  );
}
