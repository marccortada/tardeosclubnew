import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/Footer";
import { ULTIMA_ACTUALIZACION } from "@/lib/legal";

/**
 * Marco común de las páginas legales.
 * Texto grande y contrastado: el público de TardeosClub es mayor (ANALISIS §0.2).
 */
export default function PaginaLegal({
  titulo,
  entradilla,
  children,
}: {
  titulo: string;
  entradilla: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="pb-10">
        <div className="bg-gradient-to-br from-magenta to-oro px-4 pb-10 pt-8 text-white md:px-8">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center gap-2 text-sm font-black text-white/90 transition hover:text-white"
            >
              <ArrowLeft size={18} /> Volver al inicio
            </Link>
            <h1 className="mt-3 font-display text-3xl font-black md:text-4xl">{titulo}</h1>
            <p className="mt-2 text-base font-semibold text-white/90">{entradilla}</p>
          </div>
        </div>

        <div className="px-4 md:px-8">
          <div className="mx-auto max-w-3xl">
            <article className="legal -mt-6 rounded-2xl bg-white p-6 text-[17px] leading-relaxed text-tinta shadow-tarjeta ring-1 ring-black/5 md:p-8">
              {children}
              <p className="mt-8 border-t border-black/5 pt-4 text-sm font-semibold text-tinta/50">
                Última actualización: {ULTIMA_ACTUALIZACION}
              </p>
            </article>

            <nav className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-black text-tinta/60">
              <Link href="/legal/aviso-legal" className="transition hover:text-magenta">Aviso legal</Link>
              <Link href="/legal/privacidad" className="transition hover:text-magenta">Privacidad</Link>
              <Link href="/legal/cookies" className="transition hover:text-magenta">Cookies</Link>
            </nav>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
