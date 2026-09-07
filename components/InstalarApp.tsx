"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";
import { esApple, sePuedeOfrecer } from "@/lib/instalar";

/**
 * «Instálala en tu móvil».
 *
 * La web actual (tardeosclub.com) lo ofrece y esta no lo ofrecía nunca: tenía
 * el manifest y el service worker puestos —o sea, era instalable— pero no se
 * lo decía a nadie. Para una app de salir por la tarde eso no es un detalle:
 * instalada se abre de un toque desde la pantalla de inicio, y sin instalar
 * hay que acordarse de la dirección.
 *
 * LOS DOS MUNDOS SON DISTINTOS, y por eso hay dos textos:
 *
 *   Android/Chrome  -> el navegador avisa con `beforeinstallprompt`, se guarda
 *                      y se dispara el diálogo del sistema al pulsar. Un toque.
 *   iPhone/Safari   -> NO existe esa API y no va a existir. Lo único que se
 *                      puede hacer es explicar dónde está el botón. Por eso el
 *                      aviso de iOS enseña los pasos con sus iconos en vez de
 *                      un botón que no haría nada.
 *
 * CUÁNDO NO SE ENSEÑA, que es la mitad del trabajo:
 *   · si ya está instalada;
 *   · en ordenador —el sitio de esto es el bolsillo—;
 *   · si dijo «ahora no» hace menos de una semana;
 *   · si dijo «no volver a mostrar», nunca más;
 *   · en los primeros segundos de la visita. Aparecer encima de alguien que
 *     acaba de llegar es la forma más rápida de que cierre la pestaña: primero
 *     que vea que la web le sirve.
 */

const CLAVE_NUNCA = "tc-instalar-nunca";
const CLAVE_LUEGO = "tc-instalar-luego";
/** Lo que se le deja mirar antes de pedirle nada. */
const ESPERA_MS = 12000;

/** El evento de Chrome, que no está en los tipos del navegador. */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const leer = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* modo privado */ } };

export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [esIos, setEsIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Las cinco condiciones viven en `lib/instalar.ts` y están probadas una a
    // una: lo importante de este aviso son los casos en los que NO sale, y eso
    // no se comprueba mirando la pantalla.
    //
    // `standalone` es lo que mira todo el mundo para saber si ya está
    // instalada; la propiedad suelta de `navigator` es la de Safari en iOS,
    // que no implementa lo anterior en todas las versiones.
    const puede = sePuedeOfrecer({
      instalada:
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true,
      ancho: window.innerWidth,
      nunca: Boolean(leer(CLAVE_NUNCA)),
      luego: Number(leer(CLAVE_LUEGO) ?? 0),
      ahora: Date.now(),
    });
    if (!puede) return;

    const ios = esApple(navigator.userAgent);
    setEsIos(ios);

    // En Chrome se espera al aviso del navegador: si no llega, es que la web
    // no cumple algo para ser instalable y ofrecerlo sería mentir.
    const alAviso = (e: Event) => { e.preventDefault(); setEvento(e as EventoInstalar); };
    window.addEventListener("beforeinstallprompt", alAviso);

    // En iOS no hay aviso que esperar, así que se enseña por tiempo.
    const t = ios ? setTimeout(() => setVisible(true), ESPERA_MS) : null;

    return () => {
      window.removeEventListener("beforeinstallprompt", alAviso);
      if (t) clearTimeout(t);
    };
  }, []);

  // En Chrome, el aviso puede llegar en cualquier momento: se espera lo mismo
  // desde que llega, no desde que se cargó la página.
  useEffect(() => {
    if (!evento) return;
    const t = setTimeout(() => setVisible(true), ESPERA_MS);
    return () => clearTimeout(t);
  }, [evento]);

  if (!visible) return null;

  const instalar = async () => {
    if (!evento) return;
    setVisible(false);
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    // Aceptado o rechazado, el evento ya no vale: Chrome no lo vuelve a dar.
    setEvento(null);
    if (outcome !== "accepted") guardar(CLAVE_LUEGO, String(Date.now()));
  };

  const luego = () => { setVisible(false); guardar(CLAVE_LUEGO, String(Date.now())); };
  const nunca = () => { setVisible(false); guardar(CLAVE_NUNCA, "1"); };

  return (
    // Por encima de la barra de abajo (z 1000) y separado de ella, que si no
    // el botón de instalar queda pegado a los de navegar y se pulsa el que no
    // es. `bottom-24` es justo el alto de esa barra.
    <div className="fixed inset-x-3 bottom-24 z-[1100] md:hidden">
      <div className="rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marca text-white">
            <Smartphone size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-black leading-tight">
              Tenlo siempre a mano
            </p>
            <p className="mt-0.5 text-sm font-semibold text-tinta/65">
              {esIos
                ? "Añádelo a tu pantalla de inicio y se abre como una app."
                : "Se instala en diez segundos y se abre como una app."}
            </p>
          </div>
          <button onClick={luego} aria-label="Ahora no"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-tinta/40 hover:bg-black/5">
            <X size={17} />
          </button>
        </div>

        {esIos ? (
          /* En iOS no hay botón posible: solo se puede enseñar dónde está el
             de Safari. Con los iconos de verdad, porque «el cuadrado con la
             flecha» no lo identifica nadie leyéndolo. */
          <ol className="mt-3 flex flex-col gap-1.5 rounded-xl bg-crema/70 p-3 text-sm font-semibold text-tinta/80">
            <li className="flex items-center gap-2">
              <Share size={16} className="shrink-0 text-magenta" />
              Toca <b>Compartir</b>, abajo en Safari
            </li>
            <li className="flex items-center gap-2">
              <Plus size={16} className="shrink-0 text-magenta" />
              Y luego <b>Añadir a pantalla de inicio</b>
            </li>
          </ol>
        ) : (
          <button onClick={instalar}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-magenta py-3 text-base font-black text-white active:scale-[0.98]">
            <Download size={18} /> Instalar
          </button>
        )}

        <button onClick={nunca} className="mt-2 w-full text-center text-xs font-bold text-tinta/40">
          No volver a mostrar
        </button>
      </div>
    </div>
  );
}
