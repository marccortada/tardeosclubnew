import Link from "next/link";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variante?: "primario" | "oro" | "contorno";
  className?: string;
};

const estilos = {
  primario: "bg-magenta text-white shadow-tarjeta active:scale-[0.98]",
  oro: "bg-oro text-tinta shadow-tarjeta active:scale-[0.98]",
  contorno: "bg-white text-magenta border-2 border-magenta active:scale-[0.98]",
};

export default function Boton({ children, href, onClick, variante = "primario", className = "" }: Props) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-extrabold transition ${estilos[variante]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
