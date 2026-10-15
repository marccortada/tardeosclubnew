import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import Footer from "@/components/Footer";
import { RESPONSABLE, ULTIMA_ACTUALIZACION } from "@/lib/legal";

/**
 * Marco común de las páginas legales.
 * Texto grande y contrastado: el público de TardeosClub es mayor.
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
  // Mientras la entidad no esté constituida, algunos datos salen como
  // "Pendiente". Se dice una vez, arriba y sin alarmas; no se inventa nada.
  const faltanDatos = !RESPONSABLE.razonSocial || !RESPONSABLE.nif || !RESPONSABLE.domicilio;

  return (
    <>
      <main className="px-4 pb-10 pt-4 md:px-8 md:pt-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="-ml-2 inline-flex min-h-tacto items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold text-tinta transition hover:bg-marfil-100"
          >
            <ArrowLeft size={20} aria-hidden /> Inicio
          </Link>
          <h1 className="mt-2 text-[30px] font-bold leading-tight tracking-tight md:text-[40px]">{titulo}</h1>
          <p className="mt-2 text-[17px] text-tinta-suave">{entradilla}</p>

          {faltanDatos && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-linea bg-marfil-100 px-4 py-3 text-[15px] text-tinta-suave">
              <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
              {/* Texto y enlace en un solo hijo: sueltos dentro del flex, cada
                  trozo era una columna y en móvil el texto quedaba en una tira
                  de una palabra por línea. */}
              <span className="min-w-0">
                Algunos datos salen como «Pendiente»: la empresa está en constitución. Dudas:{" "}
                <a href={`mailto:${RESPONSABLE.emailContacto}`} className="font-semibold text-tinta underline [overflow-wrap:anywhere]">{RESPONSABLE.emailContacto}</a>.
              </span>
            </p>
          )}

          <article className="legal mt-6 rounded-2xl border border-linea bg-white p-5 text-[17px] leading-relaxed text-tinta shadow-tarjeta md:p-8">
            {children}
            <p className="mt-8 border-t border-linea pt-4 text-[15px] text-tinta-suave">
              Última actualización: {ULTIMA_ACTUALIZACION}
            </p>
          </article>

          <nav aria-label="Textos legales" className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[15px] font-semibold text-tinta-suave">
            <Link href="/legal/aviso-legal" className="inline-flex min-h-[44px] items-center transition hover:text-tinta">Aviso legal</Link>
            <Link href="/legal/privacidad" className="inline-flex min-h-[44px] items-center transition hover:text-tinta">Privacidad</Link>
            <Link href="/legal/cookies" className="inline-flex min-h-[44px] items-center transition hover:text-tinta">Cookies</Link>
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}
