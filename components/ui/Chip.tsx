import { ReactNode } from "react";

/**
 * Chip de filtro. Activo = relleno magenta con tick implícito por contraste
 * (no depende solo del color: el texto pasa a blanco y el borde desaparece).
 * 44 px de alto como mínimo.
 */
export default function Chip({
  children, activo = false, onClick, icono,
}: { children: ReactNode; activo?: boolean; onClick?: () => void; icono?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[15px] font-semibold transition-colors ${
        activo
          ? "border-tinta bg-tinta text-white"
          : "border-linea-fuerte bg-white text-tinta hover:border-tinta/50"
      }`}
    >
      {icono}
      {children}
    </button>
  );
}

/** Etiqueta de estado (no pulsable). Siempre con texto, nunca solo color. */
export function Etiqueta({
  children, tono = "neutro",
}: { children: ReactNode; tono?: "neutro" | "ok" | "aviso" | "error" | "marca" }) {
  const t = {
    neutro: "bg-marfil-100 text-tinta-suave",
    ok: "bg-ok-fondo text-ok",
    aviso: "bg-aviso-fondo text-aviso",
    error: "bg-error-fondo text-error",
    marca: "bg-magenta-50 text-magenta-700",
  }[tono];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${t}`}>{children}</span>;
}
