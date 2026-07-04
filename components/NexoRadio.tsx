import { Radio, ArrowUpRight } from "lucide-react";

export default function NexoRadio() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 md:px-8">
      <a
        href="https://nexoradio.es/"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl bg-black p-6 text-white shadow-tarjeta transition hover:brightness-110 md:flex-row md:gap-8 md:p-8"
      >
        {/* Glows de la marca Nexo */}
        <span className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#ff2d9e] opacity-30 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-12 right-10 h-40 w-40 rounded-full bg-[#22d3ee] opacity-25 blur-3xl" />

        <img
          src="/branding/nexo-radio.png"
          alt="Nexo Radio"
          className="relative h-28 w-28 shrink-0 rounded-2xl object-cover md:h-32 md:w-32"
        />

        <div className="relative flex-1 text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-white/80">
            <Radio size={13} /> Radio colaboradora
          </span>
          <h2 className="mt-2 font-display text-2xl font-black leading-tight md:text-3xl">
            Escucha <span className="text-[#ff2d9e]">Nexo</span> <span className="text-[#22d3ee]">Radio</span>
          </h2>
          <p className="mt-1 font-semibold text-white/70">La voz de la música electrónica, en directo mientras vives el tardeo.</p>
        </div>

        <span className="relative inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-lg font-extrabold text-black transition group-hover:scale-105">
          Escuchar en directo <ArrowUpRight size={20} />
        </span>
      </a>
    </section>
  );
}
