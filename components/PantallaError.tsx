"use client";

import { useEffect } from "react";
import { RefreshCw, Home, LifeBuoy } from "lucide-react";
import { claseBoton } from "@/components/Boton";
import ReportarProblema from "@/components/ReportarProblema";
import { enviarError } from "@/lib/erroresCliente";

/**
 * La pantalla que sale cuando una página revienta (app/error.tsx y
 * app/global-error.tsx). Antes salía la de Next en inglés y en blanco, sin
 * salida: la gente cerraba la pestaña y nadie se enteraba.
 *
 * Al montarse, manda el error a /admin/errores; y ofrece reintentar, volver
 * al inicio o avisar con el error ya adjunto.
 */
export default function PantallaError({
  error, reintentar,
}: { error: Error & { digest?: string }; reintentar?: () => void }) {
  useEffect(() => { void enviarError(error); }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-magenta-50 text-magenta">
        <LifeBuoy size={32} aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight md:text-[28px]">Vaya, esta página ha fallado</h1>
      <p className="mt-2 text-[16px] text-tinta-suave">
        No es culpa tuya. Prueba otra vez; si sigue igual, avísanos contándonos qué intentabas hacer y lo miramos.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        {reintentar && (
          <button type="button" onClick={reintentar} className={claseBoton("primario")}>
            <RefreshCw size={18} aria-hidden /> Reintentar
          </button>
        )}
        {/* <a> y no <Link>: si lo roto es la navegación, una carga completa sí sale. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={claseBoton("contorno")}>
          <Home size={18} aria-hidden /> Volver al inicio
        </a>
      </div>
      <ReportarProblema
        etiqueta="Avisar del problema"
        error={{ mensaje: `${error.name}: ${error.message}`.slice(0, 500), digest: error.digest }}
        className="mt-4 inline-flex min-h-[44px] items-center px-2 text-[16px] font-semibold text-magenta-700 underline underline-offset-4 hover:text-magenta"
      />
      {error.digest && <p className="mt-6 text-[13px] text-tinta-suave">Código del error: {error.digest}</p>}
    </main>
  );
}
