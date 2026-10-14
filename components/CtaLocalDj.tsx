import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { FOTOS, foto } from "@/lib/fotos";

/**
 * La llamada a darse de alta como colaborador: dos bloques grandes con foto,
 * uno para locales y eventos y otro para DJs.
 *
 * Dos puertas y no tres: "Local o evento" agrupa al local con dirección fija y
 * al promotor que organiza en sitios distintos (dentro de /unirse se elige
 * cuál). Van a /unirse con el rol puesto y no a los paneles: esto lo lee quien
 * AÚN NO es nada.
 */
const PUERTAS = [
  {
    rol: "local",
    foto: foto(FOTOS.bar, 1100),
    etiqueta: "Para locales y promotores",
    titulo: "Llena tu local cada tarde",
    puntos: [
      "Publica un tardeo en minutos: subes el cartel y la IA rellena los datos",
      "Sales en el listado, el mapa y los avisos de tu zona",
      "Ves quién se apunta y pasas lista en la puerta",
    ],
    boton: "Dar de alta mi local",
    tinte: "from-[#120810]/95 via-[#120810]/80 to-magenta-700/60",
  },
  {
    rol: "dj",
    foto: foto(FOTOS.dj, 1100),
    etiqueta: "Para DJs",
    titulo: "Que te encuentren y te contraten",
    puntos: [
      "Tu perfil con estilos, sesiones y press kit en PDF",
      "Los tardeos donde pinchas, en tu ficha y en la de cada tardeo",
      "Los locales te contactan por WhatsApp",
    ],
    boton: "Crear mi perfil de DJ",
    tinte: "from-[#120810]/95 via-[#120810]/80 to-naranja/50",
  },
];

export default function CtaLocalDj() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
      <p className="font-script text-[24px] text-magenta">¿Organizas o pinchas?</p>
      <h2 className="text-[30px] font-extrabold leading-tight tracking-tight md:text-[40px]">Súmate a TardeosClub</h2>
      <p className="mt-2 max-w-2xl text-[16px] text-tinta-suave">Crear tu perfil es gratis. Lo revisamos y en cuanto está aprobado ya sale en la web.</p>

      <div className="revelar-hijos mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
        {PUERTAS.map((p) => (
          <Link key={p.rol} href={`/unirse?rol=${p.rol}`}
            className="group relative isolate flex min-h-[420px] flex-col justify-end overflow-hidden rounded-3xl p-6 text-white md:p-8">
            <Image src={p.foto} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 560px"
              className="-z-20 object-cover transition-transform duration-500 group-hover:scale-105" />
            <span aria-hidden className={`absolute inset-0 -z-10 bg-gradient-to-t ${p.tinte}`} />
            <span className="text-[13px] font-semibold uppercase tracking-wider text-oro-400">{p.etiqueta}</span>
            <span className="mt-2 block text-[28px] font-extrabold leading-tight tracking-tight md:text-[34px]">{p.titulo}</span>
            <ul className="mt-4 flex flex-col gap-2">
              {p.puntos.map((x) => (
                <li key={x} className="flex items-start gap-2.5 text-[16px] leading-snug text-white/90">
                  <Check size={18} className="mt-0.5 shrink-0 text-oro-400" aria-hidden /> {x}
                </li>
              ))}
            </ul>
            <span className="mt-6 inline-flex min-h-tacto items-center justify-center gap-2 self-start rounded-xl bg-oro-400 px-6 text-[17px] font-bold text-tinta transition group-hover:bg-oro">
              {p.boton} <ArrowRight size={18} className="transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
