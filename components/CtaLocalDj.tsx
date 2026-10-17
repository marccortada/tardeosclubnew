import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FOTOS, propsFoto } from "@/lib/fotos";

/**
 * La llamada a darse de alta como colaborador: una tarjeta con foto para
 * locales y eventos y otra para DJs.
 *
 * Dos puertas y no tres: "Local o evento" agrupa al local con dirección fija y
 * al promotor que organiza en sitios distintos (dentro de /unirse se elige
 * cuál). Van a /unirse con el rol puesto y no a los paneles: esto lo lee quien
 * AÚN NO es nada.
 *
 * Corta a propósito (título, una frase y el botón): la portada la abre sobre
 * todo el público desde el móvil, y a un local le basta con saber que existe
 * la puerta; el detalle lo tiene /unirse.
 */
const PUERTAS = [
  {
    rol: "local",
    foto: FOTOS.bar,
    etiqueta: "Locales y promotores",
    titulo: "Llena tu local cada tarde",
    texto: "Sube el cartel, la IA rellena el tardeo y sales en el mapa y los avisos de tu zona.",
    boton: "Dar de alta mi local",
    tinte: "from-[#120810]/95 via-[#120810]/70 to-magenta-700/40",
  },
  {
    rol: "dj",
    foto: FOTOS.dj,
    etiqueta: "DJs",
    titulo: "Que te encuentren y te llamen",
    texto: "Tu perfil con sesiones, estilos y los tardeos donde pinchas.",
    boton: "Crear mi perfil de DJ",
    tinte: "from-[#120810]/95 via-[#120810]/70 to-naranja/40",
  },
];

export default function CtaLocalDj() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
      <h2 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-[34px]">¿Organizas o pinchas?</h2>
      <p className="mt-1.5 text-[16px] text-tinta-suave">Tu perfil es gratis y sale en cuanto lo aprobamos.</p>

      <div className="revelar-hijos mt-6 grid gap-4 md:grid-cols-2 md:gap-5">
        {PUERTAS.map((p) => (
          <Link key={p.rol} href={`/unirse?rol=${p.rol}`}
            className="group relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden rounded-3xl p-5 text-white md:min-h-[360px] md:p-7">
            {/* eslint-disable-next-line @next/next/no-img-element -- srcset de Unsplash calculado con getImageProps (ver lib/fotos.ts) */}
            <img {...propsFoto(p.foto, { sizes: "(min-width: 768px) 560px, 100vw" })} alt=""
              className="-z-20 object-cover transition-transform duration-500 group-hover:scale-105" />
            <span aria-hidden className={`absolute inset-0 -z-10 bg-gradient-to-t ${p.tinte}`} />
            <span className="text-[13px] font-bold uppercase tracking-wider text-oro-400">{p.etiqueta}</span>
            <span className="mt-1.5 block text-[26px] font-extrabold leading-tight tracking-tight md:text-[32px]">{p.titulo}</span>
            <span className="mt-2 block max-w-md text-[16px] leading-snug text-white/90">{p.texto}</span>
            <span className="mt-5 inline-flex min-h-tacto items-center justify-center gap-2 self-start rounded-xl bg-oro-400 px-5 text-[17px] font-bold text-sobre-oro transition group-hover:bg-oro">
              {p.boton} <ArrowRight size={18} className="transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
