"use client";

import { useState } from "react";
import { Megaphone, ChevronRight, X, Check, Sparkles } from "lucide-react";

const BENEFICIOS = [
  { emoji: "👀", titulo: "Comunidad de +50.000 visitas al mes", desc: "Tu tardeo lo ven miles de tardícolas activos." },
  { emoji: "💬", titulo: "Grupo de WhatsApp de tardícolas", desc: "Compartimos tu tardeo en nuestra comunidad." },
  { emoji: "⭐", titulo: "Destacado con el sello dorado", desc: "Aparece arriba, el primero de tu zona." },
  { emoji: "📸", titulo: "Difusión en nuestras redes", desc: "Publicamos tu evento en Instagram." },
  { emoji: "🤖", titulo: "Flyer con IA incluido", desc: "Creamos o mejoramos tu flyer con la marca." },
];

export default function PromocionModal() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex w-full items-center gap-4 rounded-2xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><Megaphone size={24} /></span>
        <div className="flex-1">
          <p className="text-lg font-black leading-tight">Promociona tus tardeos</p>
          <p className="text-sm font-semibold text-tinta/60">Llega a más gente · destacado + sello</p>
        </div>
        <ChevronRight size={20} className="text-tinta/30" />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-[#f5f3f4] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera de marca */}
            <div className="relative overflow-hidden bg-marca p-6 text-white">
              <span className="bokeh" style={{ width: 120, height: 120, top: -30, right: 20, background: "#ffd36b", opacity: 0.4 }} />
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                <Sparkles size={14} className="text-oro-400" /> Promoción destacada
              </span>
              <h3 className="mt-3 font-display text-2xl font-black leading-tight">Haz que tu tardeo llene</h3>
              <p className="mt-1 font-semibold text-white/90">Esto es lo que consigues al destacarlo:</p>
            </div>

            {/* Beneficios */}
            <div className="max-h-[45vh] overflow-y-auto p-5">
              <ul className="flex flex-col gap-3">
                {BENEFICIOS.map((b) => (
                  <li key={b.titulo} className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-lg shadow-tarjeta ring-1 ring-black/5">{b.emoji}</span>
                    <div>
                      <p className="font-black leading-tight">{b.titulo}</p>
                      <p className="text-sm font-semibold text-tinta/60">{b.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="border-t border-black/5 bg-white p-5">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white shadow-lg transition hover:brightness-105 active:scale-[0.98]"
              >
                <Check size={22} /> Quiero destacar mi tardeo
              </button>
              <p className="mt-2 text-center text-xs font-semibold text-tinta/50">
                Pronto podrás pagarlo aquí mismo. Mientras, te contactamos para activarlo.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
