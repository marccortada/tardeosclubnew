"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CarruselTardeos from "@/components/CarruselTardeos";
import { useAuth } from "@/lib/useAuth";
import { getAdn, tieneAdn, type AdnTardicola } from "@/lib/tardicola";
import { paraTi } from "@/lib/recomendar";
import type { Tardeo } from "@/lib/types";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * El carrusel "Para ti" de la portada.
 *
 * Es de cliente porque los gustos son de cada uno y la portada se cachea un
 * minuto para todo el mundo: si esto se calculara en el servidor, el primero
 * en entrar le dejaría sus recomendaciones al siguiente durante un minuto.
 * Los tardeos ya vienen cargados de arriba, así que no hay consulta extra.
 *
 * No se pinta nada mientras se comprueba: un carrusel que aparece y desaparece
 * al cargar mueve la página entera bajo el dedo de quien ya estaba leyendo.
 */
export default function ParaTi({ tardeos }: { tardeos: Tardeo[] }) {
  const { user, loading } = useAuth();
  const [adn, setAdn] = useState<AdnTardicola | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setListo(true); return; }
    getAdn(user.id).then((a) => { setAdn(a); setListo(true); });
  }, [user, loading]);

  if (!listo) return null;

  // Sin sesión no se invita a nada aquí: la portada ya tiene su llamada a
  // registrarse y no hace falta otra.
  if (!user) return null;

  /**
   * Con sesión pero sin gustos, se ofrece rellenarlos. Es el único sitio donde
   * pedirlos tiene sentido después del alta: aquí se ve el hueco que llenarían.
   */
  if (!tieneAdn(adn)) {
    return (
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-8">
        <Link
          href="/perfil/gustos"
          className="group flex items-center gap-4 rounded-3xl bg-white p-5 shadow-tarjeta ring-1 ring-magenta-100 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-marca text-white">
            <Sparkles size={26} />
          </span>
          <span className="flex-1">
            <span className="block font-display text-xl font-black">Dinos qué te gusta</span>
            <span className="text-sm font-semibold text-tinta/60">
              Y te proponemos tardeos que encajan, en vez de una lista sin más.
            </span>
          </span>
          <ArrowRight className="shrink-0 text-magenta transition group-hover:translate-x-1" />
        </Link>
      </section>
    );
  }

  // Si no hay suficientes que encajen de verdad, paraTi() devuelve vacío y el
  // carrusel no se pinta: mejor nada que un "Para ti" con planes que no tienen
  // que ver con lo que dijo.
  const suyos = paraTi(tardeos, adn);
  return (
    <CarruselTardeos
      titulo={<>Para ti <Sparkles size={22} className="text-oro" /></>}
      tardeos={suyos}
    />
  );
}
