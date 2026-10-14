import { ReactNode } from "react";

/** Clase única de input/textarea/select: 48 px de alto, borde grueso, foco claro. */
export const claseCampo =
  "w-full min-h-tacto rounded-xl border border-linea-fuerte bg-white px-4 py-3 text-base font-medium text-tinta placeholder:text-tinta-suave/70 outline-none transition focus:border-magenta focus:ring-4 focus:ring-magenta/15 disabled:bg-marfil-100 disabled:opacity-70";

/**
 * Etiqueta + control + ayuda/error. La etiqueta va SIEMPRE visible encima (un
 * placeholder desaparece al escribir y confunde). Pasa el control como hijo.
 */
export default function Campo({
  etiqueta, ayuda, error, children, htmlFor,
}: { etiqueta: string; ayuda?: string; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[15px] font-semibold text-tinta">{etiqueta}</label>
      {children}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-error">{error}</p>
      ) : ayuda ? (
        <p className="text-sm text-tinta-suave">{ayuda}</p>
      ) : null}
    </div>
  );
}
