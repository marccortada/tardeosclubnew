import Image from "next/image";
import Link from "next/link";
import { Store, Megaphone, Disc3 } from "lucide-react";

/**
 * La llamada a darse de alta como colaborador.
 *
 * Los tres roles que existen, no dos: el promotor se añadió después y este
 * banner se quedó atrás, así que quien organiza fiestas sin local fijo no se
 * veía reflejado en ninguna parte de la portada.
 *
 * Van a /unirse con el rol puesto y no a los paneles. Esto lo lee quien AÚN NO
 * es nada: mandarlo a /local es mandarlo a un panel que no tiene, y a /perfil,
 * a una pantalla de login sin decirle para qué.
 */
const ROLES = [
  { rol: "local", icono: Store, texto: "Soy un local", clase: "bg-white text-magenta" },
  { rol: "promotor", icono: Megaphone, texto: "Soy promotor", clase: "bg-white/15 text-white ring-1 ring-white/40" },
  { rol: "dj", icono: Disc3, texto: "Soy DJ", clase: "bg-oro text-tinta" },
];

export default function CtaLocalDj() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 md:px-8 md:pt-14">
      <div className="relative overflow-hidden rounded-3xl bg-marca p-6 text-white shadow-tarjeta md:p-10">
        <Image src="/img/dj.jpg" alt="" aria-hidden="true" fill sizes="(max-width: 768px) 100vw, 900px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2a0616]/90 via-[#8a0d49]/75 to-[#8a0d49]/40" />
        <span className="bokeh" style={{ width: 120, height: 120, top: -20, right: 40, background: "#ffd36b", opacity: 0.4 }} />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-black leading-tight md:text-4xl">
              ¿Tienes un local, organizas fiestas o pinchas?
            </h2>
            <p className="mt-1 font-semibold text-white/90 md:text-lg">
              Publica tus tardeos con ayuda de la IA y llega a miles de tardícolas.
            </p>
          </div>
          {/* En columna hasta pantallas grandes: tres botones en fila no caben en
              un móvil sin quedarse en dos letras cada uno. */}
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            {ROLES.map(({ rol, icono: Icono, texto, clase }) => (
              <Link
                key={rol}
                href={`/unirse?rol=${rol}`}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-lg font-extrabold shadow-lg transition hover:brightness-105 active:scale-[0.98] ${clase}`}
              >
                <Icono size={22} /> {texto}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
