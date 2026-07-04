import { getDjsPublicos } from "@/lib/tardeos";
import DjCard from "@/components/DjCard";
import type { Metadata } from "next";
import { Disc3 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DJs · TardeosClub",
  description: "Descubre a los DJs de los tardeos: estilos, reputación y dónde pinchan.",
};

export default async function DirectorioDjs() {
  const djs = await getDjsPublicos();

  return (
    <main className="mx-auto max-w-6xl px-4 pt-5 md:px-8 md:pt-8">
      <div className="mb-4">
        <p className="font-script text-xl leading-none text-magenta-600 md:text-2xl">Los que ponen la música</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-black leading-tight md:text-3xl">
          <Disc3 size={26} className="text-magenta" /> Nuestros DJs
        </h1>
      </div>

      {djs.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
          Aún no hay DJs publicados.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {djs.map((dj) => (
            <DjCard key={dj.id} dj={dj} />
          ))}
        </div>
      )}
    </main>
  );
}
