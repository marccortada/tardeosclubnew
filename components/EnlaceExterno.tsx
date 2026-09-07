"use client";

import { medir, type Canal } from "@/lib/metricas";
import { urlSegura } from "@/lib/enlaces";

/**
 * Un enlace que sale de la web y deja constancia de que alguien lo pulsó.
 *
 * Hasta ahora solo se medían dos salidas: comprar entrada y apuntarse a lista.
 * Todo lo demás que hace quien ya se ha decidido —escribir por WhatsApp, abrir
 * el Instagram, ir a la web, reservar, mirar cómo llegar— no dejaba rastro, así
 * que un local no tenía forma de saber cuánta gente le llega desde aquí. Es
 * literalmente el argumento para renovar la suscripción.
 *
 * La medición NO retrasa la navegación. `medir` no se espera: el navegador abre
 * la pestaña y la petición se va en paralelo. Si se perdiera un clic por eso,
 * mejor perderlo que hacer esperar a alguien que quiere llamar a un bar.
 */
export default function EnlaceExterno({
  href, canal, localId, tardeoId, className, children, ariaLabel,
}: {
  href: string;
  canal: Canal;
  localId?: string;
  tardeoId?: string;
  className?: string;
  children: React.ReactNode;
  /** Solo hace falta cuando dentro no hay texto, como en un botón de icono. */
  ariaLabel?: string;
}) {
  // El destino se valida aquí también, aunque casi siempre venga ya limpio: es
  // el último sitio por el que pasa antes de convertirse en un enlace, y varios
  // de estos los escribe el propio local en su panel.
  const destino = urlSegura(href) ?? href;

  return (
    <a
      href={destino}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={() => { void medir("clic_contacto", { localId, tardeoId, destino, detalle: canal }); }}
      className={className}
    >
      {children}
    </a>
  );
}
