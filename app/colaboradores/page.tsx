import { getDjsPublicos, getLocalesPublicos } from "@/lib/tardeos";
import ColaboradoresLista from "@/components/ColaboradoresLista";
import type { Metadata } from "next";
import { Handshake } from "lucide-react";

// Cambia poco: no hace falta consultar Supabase en cada visita.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Colaboradores · TardeosClub",
  description:
    "Los locales, promotores y DJs que hacen los tardeos de la costa catalana.",
};

/**
 * Directorio único de quien hace los tardeos. Antes solo existía el de DJs, y
 * los locales solo se podían descubrir tropezándose con uno en el mapa.
 *
 * La consulta se hace aquí (servidor) y el filtrado por pestañas en el cliente:
 * son cientos de fichas como mucho, así que cambiar de pestaña es instantáneo
 * y no dispara otra consulta.
 */
export default async function Colaboradores() {
  const [locales, djs] = await Promise.all([getLocalesPublicos(), getDjsPublicos()]);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-5 md:px-8 md:pt-8">
      <div className="mb-4">
        <p className="font-script text-xl leading-none text-magenta-600 md:text-2xl">
          Los que montan la fiesta
        </p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-black leading-tight md:text-3xl">
          <Handshake size={26} className="text-magenta" /> Colaboradores
        </h1>
      </div>

      <ColaboradoresLista locales={locales} djs={djs} />
    </main>
  );
}
