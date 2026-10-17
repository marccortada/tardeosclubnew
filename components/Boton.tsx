import Link from "next/link";
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * El botón de TardeosClub. Plano, sólido y con 48 px de alto como mínimo (se
 * acierta con el pulgar). Texto de 16-17 px en negrita.
 *
 * Una pantalla = UN botón `primario`. Lo demás, `contorno` o `suave`.
 */
type Variante = "primario" | "oro" | "fiesta" | "contorno" | "suave" | "peligro";
type Tamano = "normal" | "pequeno";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variante?: Variante;
  tamano?: Tamano;
  /** Ocupa todo el ancho (lo normal en móvil). */
  ancho?: boolean;
  cargando?: boolean;
  disabled?: boolean;
  externo?: boolean;
  className?: string;
  "aria-label"?: string;
};

const estilos: Record<Variante, string> = {
  primario: "bg-magenta text-white shadow-plastilina hover:bg-magenta-600 active:bg-magenta-700",
  oro: "bg-oro-400 text-sobre-oro shadow-plastilina-oro hover:bg-oro active:bg-oro-600",
  // El degradado rosa→naranja de la web de siempre ("Filtrar tardeos").
  fiesta: "bg-fiesta text-white shadow-plastilina hover:brightness-105 active:brightness-95",
  contorno: "bg-white text-tinta border border-linea-fuerte hover:border-tinta/40 hover:bg-marfil active:bg-marfil-100",
  suave: "bg-magenta-50 text-magenta-700 hover:bg-magenta-100 active:bg-magenta-100",
  peligro: "bg-error text-white hover:brightness-110 active:brightness-95",
};

const tamanos: Record<Tamano, string> = {
  normal: "min-h-tacto px-5 py-3 text-[17px]",
  pequeno: "min-h-[44px] px-4 py-2 text-base",
};

export function claseBoton(variante: Variante = "primario", tamano: Tamano = "normal", ancho = false, extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-xl font-bold leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${tamanos[tamano]} ${estilos[variante]} ${ancho ? "w-full" : ""} ${extra}`;
}

export default function Boton({
  children, href, onClick, type = "button", variante = "primario", tamano = "normal",
  ancho = false, cargando = false, disabled = false, externo = false, className = "", ...rest
}: Props) {
  const cls = claseBoton(variante, tamano, ancho, className);
  if (href) {
    return externo ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={rest["aria-label"]}>{children}</a>
    ) : (
      <Link href={href} className={cls} aria-label={rest["aria-label"]}>{children}</Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || cargando} aria-busy={cargando || undefined}
      aria-label={rest["aria-label"]} className={cls}>
      {cargando && <Loader2 size={20} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
