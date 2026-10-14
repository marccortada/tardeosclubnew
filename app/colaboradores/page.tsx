import { getDjsPublicos, getLocalesPublicos, getTardeosPublicados } from "@/lib/tardeos";
import ColaboradoresLista from "@/components/ColaboradoresLista";
import type { Metadata } from "next";
import { metadataPublica } from "@/lib/seo";

// Cambia poco: no hace falta consultar Supabase en cada visita.
// Se pinta en cada visita, no por ISR: ver el porqué en app/page.tsx.
export const dynamic = "force-dynamic";

export const metadata: Metadata = metadataPublica(
  "Colaboradores · TardeosClub",
  "Los locales, promotores, eventos y DJs que hacen los tardeos de la costa catalana.",
  "/colaboradores"
);

/**
 * Directorio único de quien hace los tardeos. Antes solo existía el de DJs, y
 * los locales solo se podían descubrir tropezándose con uno en el mapa.
 *
 * La consulta se hace aquí (servidor) y el filtrado por pestañas en el cliente:
 * son cientos de fichas como mucho, así que cambiar de pestaña es instantáneo
 * y no dispara otra consulta.
 */
export default async function Colaboradores() {
  const [locales, djs, tardeos] = await Promise.all([
    getLocalesPublicos(), getDjsPublicos(), getTardeosPublicados(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-8 md:pt-10">
      <div className="mb-6">
        <h1 className="font-display text-[34px] font-bold leading-[1.1] md:text-[48px]">Locales, eventos y DJs</h1>
        <p className="mt-2 max-w-2xl text-[16px] text-tinta-suave md:text-[17px]">Los que montan los tardeos de la costa. Entra en su ficha para ver sus próximos planes.</p>
      </div>

      {/* Sin Suspense a propósito: la lista ya no usa useSearchParams, así que
          se renderiza en el servidor y las fichas llegan dentro del HTML. */}
      <ColaboradoresLista locales={locales} djs={djs} tardeos={tardeos} />
    </main>
  );
}
