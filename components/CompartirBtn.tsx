"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export default function CompartirBtn({
  titulo,
  texto,
  url: urlProp,
  className = "",
  etiqueta,
}: {
  titulo: string;
  texto?: string;
  /** Ruta ("/tardeos/123") o URL absoluta. Si no se pasa, usa la página actual. */
  url?: string;
  className?: string;
  /** Texto junto al icono. Sin él es un botón redondo solo con icono. */
  etiqueta?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const compartir = async (e?: React.MouseEvent) => {
    // Si está dentro de un enlace (tarjeta), no navegamos
    e?.preventDefault();
    e?.stopPropagation();

    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = urlProp
      ? urlProp.startsWith("http") ? urlProp : base + urlProp
      : typeof window !== "undefined" ? window.location.href : "";
    const mensaje = texto || titulo;

    // 1) Menú nativo del móvil (WhatsApp, Instagram, Telegram…)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: titulo, text: mensaje, url });
        return;
      } catch {
        return; // el usuario canceló
      }
    }

    // 2) Fallback: copiar enlace al portapapeles
    try {
      await navigator.clipboard.writeText(`${mensaje} ${url}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // 3) Último recurso: abrir WhatsApp Web
      window.open(`https://wa.me/?text=${encodeURIComponent(`${mensaje} ${url}`)}`, "_blank");
    }
  };

  return (
    <button
      onClick={(e) => compartir(e)}
      aria-label={etiqueta ? undefined : "Compartir"}
      className={className || "grid h-11 w-11 place-items-center rounded-full bg-white/90 text-tinta shadow transition hover:bg-white active:scale-95"}
    >
      {copiado ? <Check size={etiqueta ? 18 : 22} className="text-ok" aria-hidden /> : <Share2 size={etiqueta ? 18 : 22} aria-hidden />}
      {etiqueta && <span>{copiado ? "Enlace copiado" : etiqueta}</span>}
      {/* Sin texto visible, el aviso de copiado se anuncia igual al lector. */}
      {!etiqueta && copiado && <span className="sr-only" role="status">Enlace copiado</span>}
    </button>
  );
}
