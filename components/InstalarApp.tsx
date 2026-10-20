"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
 *   · en la primera visita (cuenta visitas, una por sesión);
 *   · en los primeros segundos de la visita. Aparecer encima de alguien que
 *     acaba de llegar es la forma más rápida de que cierre la pestaña: primero
 *     que vea que la web le sirve.
 */

const CLAVE_NUNCA = "tc-instalar-nunca";
const CLAVE_LUEGO = "tc-instalar-luego";
/** Visitas contadas (una por sesión del navegador, no por página). */
const CLAVE_VISITAS = "tc-visitas";
const CLAVE_SESION = "tc-visita-contada";
/**
 * Solo desde la 2.ª visita. En la primera, el aviso salía encima de los chips
 * del hero («Hoy · Este finde · Cerca de mí») justo cuando alguien decide si
 * la web le sirve. Quien vuelve ya ha visto que sí: ahí tiene sentido.
 */
const VISITAS_MINIMAS = 2;
/** Lo que se le deja mirar antes de pedirle nada. */
const ESPERA_MS = 12000;

/** El evento de Chrome, que no está en los tipos del navegador. */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const leer = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* modo privado */ } };

/** Suma una visita la primera vez en esta sesión y devuelve el total. */
function contarVisita(): number {
  try {
    let n = Number(localStorage.getItem(CLAVE_VISITAS) ?? 0) || 0;
    if (!sessionStorage.getItem(CLAVE_SESION)) {
      n += 1;
      localStorage.setItem(CLAVE_VISITAS, String(n));
      sessionStorage.setItem(CLAVE_SESION, "1");
    }
    return n;
  } catch { return 0; } // sin almacenamiento no se puede saber si vuelve: no se ofrece
}

/**
 * Pantallas con algo fijo abajo que el aviso taparía: la ficha del tardeo
 * (barra de Asistiré) y el feed de DJs (pantalla completa).
 */
const RUTAS_SIN_AVISO = [/^\/tardeos\/[^/]+$/, /^\/djs(\/|$)/];

export default function InstalarApp() {
  const pathname = usePathname();
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [esIos, setEsIos] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pasos, setPasos] = useState(false); // iOS: pasos de Safari desplegados

  useEffect(() => {
    // Se cuenta siempre, aunque luego no se ofrezca: es «cuántas veces ha venido».
    const visitas = contarVisita();
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
    if (!puede || visitas < VISITAS_MINIMAS) return;

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

  if (!visible || RUTAS_SIN_AVISO.some((r) => r.test(pathname))) return null;

  const instalar = async () => {
    if (esIos) { setPasos((v) => !v); return; }
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
    // Franja compacta (~56 px) justo encima de la barra de abajo, cuya altura
    // real publica BottomNav en --alto-barra-inferior. Antes era una tarjeta
    // de ~200 px que tapaba media pantalla. Si suena música, también sube por
    // encima del mini‑reproductor (--alto-mini), que si no la tapaba.
    <div role="dialog" aria-label="Instalar la app de TardeosClub"
      style={{ bottom: "calc(var(--alto-barra-inferior, 96px) + var(--alto-mini, 0px) + 8px)" }}
      className="fixed inset-x-3 z-[1100] md:hidden">
      <div className="rounded-2xl border border-linea bg-white shadow-elevada">
        <div className="flex min-h-[56px] items-center gap-2 py-1.5 pl-3 pr-1">
          <Smartphone size={22} className="shrink-0 text-magenta" aria-hidden />
          <p className="min-w-0 flex-1 text-[15px] font-semibold leading-tight text-tinta">Tenlo a mano como app</p>
          <button type="button" onClick={instalar} aria-expanded={esIos ? pasos : undefined}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-magenta px-3 text-[15px] font-bold text-white">
            <Download size={17} aria-hidden /> Instalar app
          </button>
          <button type="button" onClick={luego} aria-label="Ahora no"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-tinta-suave hover:bg-marfil-100">
            <X size={18} aria-hidden />
          </button>
        </div>

        {esIos && pasos && (
          /* En iOS no hay botón posible: solo se puede enseñar dónde está el
             de Safari. Con los iconos de verdad, porque «el cuadrado con la
             flecha» no lo identifica nadie leyéndolo. */
          <div className="px-3 pb-2">
            <ol className="flex flex-col gap-1.5 rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta">
              <li className="flex items-center gap-2">
                <Share size={16} className="shrink-0 text-magenta" aria-hidden />
                Toca <b>Compartir</b>, abajo en Safari
              </li>
              <li className="flex items-center gap-2">
                <Plus size={16} className="shrink-0 text-magenta" aria-hidden />
                Y luego <b>Añadir a pantalla de inicio</b>
              </li>
            </ol>
            <button type="button" onClick={nunca} className="mt-1 min-h-[44px] w-full text-center text-[15px] font-semibold text-tinta-suave">
              No volver a mostrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
