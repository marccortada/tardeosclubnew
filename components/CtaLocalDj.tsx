import Image from "next/image";
import Link from "next/link";
import { Store, Disc3 } from "lucide-react";

export default function CtaLocalDj() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 md:px-8 md:pt-14">
      <div className="relative overflow-hidden rounded-3xl bg-marca p-6 text-white shadow-tarjeta md:p-10">
        <Image src="/img/dj.jpg" alt="" aria-hidden="true" fill sizes="(max-width: 768px) 100vw, 900px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2a0616]/90 via-[#8a0d49]/75 to-[#8a0d49]/40" />
        <span className="bokeh" style={{ width: 120, height: 120, top: -20, right: 40, background: "#ffd36b", opacity: 0.4 }} />
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-black leading-tight md:text-4xl">
              ¿Tienes un local o eres DJ?
            </h2>
            <p className="mt-1 font-semibold text-white/90 md:text-lg">
              Publica tus tardeos con ayuda de la IA y llega a miles de tardícolas.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              href="/local"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-lg font-extrabold text-magenta shadow-lg transition hover:brightness-105 active:scale-[0.98]"
            >
              <Store size={22} /> Soy un local
            </Link>
            <Link
              href="/perfil"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-oro px-6 py-4 text-lg font-extrabold text-tinta shadow-lg transition hover:brightness-105 active:scale-[0.98]"
            >
              <Disc3 size={22} /> Soy DJ
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
