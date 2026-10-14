"use client";

import { useState } from "react";
import { Megaphone, ChevronRight, Star, MessageCircle, Mail, Check } from "lucide-react";
import Hoja from "@/components/ui/Hoja";
import { whatsappTardeos, emailTardeos } from "@/components/ServiciosExternos";

/**
 * Pedir que destaquen un tardeo.
 *
 * Antes esta ventana prometía «+50.000 visitas al mes», grupo de WhatsApp,
 * difusión en Instagram y flyer con IA incluido —nada de eso estaba medido ni
 * contratado— y su botón «Quiero destacar mi tardeo» no hacía nada: no tenía
 * ni onClick. Un local que lo pulsaba se quedaba esperando una llamada que
 * nunca llegaba.
 *
 * Ahora solo dice lo que de verdad hace un destacado (lo pone el equipo desde
 * Administración → Destacados) y el botón abre una conversación real con
 * TardeosClub, con el mensaje ya escrito. No se cobra nada desde la web.
 */
export function ContactoDestacar({ titulo }: { titulo?: string }) {
  const que = titulo ? `«${titulo}»` : "mis tardeos";
  const mensaje = `Hola, quiero destacar ${que} en TardeosClub. ¿Qué opciones hay y cuánto cuesta?`;
  return (
    <div>
      <ul className="flex flex-col gap-3">
        {[
          "Sale en el bloque «Destacados» de la portada, antes que el resto de tardeos.",
          "Su tarjeta lleva la marca de destacado.",
          "Lo activa el equipo de TardeosClub para las fechas que acordéis.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3 text-[15px]">
            <Check size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden /> {t}
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta">
        Te contamos opciones y precio antes de nada. <b>No se cobra nada desde la web.</b>
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <a href={whatsappTardeos(mensaje)} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-tacto items-center justify-center gap-2 rounded-xl bg-magenta px-5 text-[17px] font-bold text-white hover:bg-magenta-600">
          <MessageCircle size={20} aria-hidden /> Quiero destacar {titulo ? "este tardeo" : "un tardeo"}
        </a>
        <a href={emailTardeos(`Quiero destacar ${que}`, mensaje)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-linea-fuerte bg-white px-5 text-[15px] font-semibold hover:bg-marfil-100">
          <Mail size={18} aria-hidden /> Prefiero escribir un email
        </a>
      </div>
    </div>
  );
}

export default function PromocionModal({
  variante = "card",
  titulo,
}: {
  variante?: "card" | "boton";
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {variante === "boton" ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex min-h-tacto w-full items-center justify-center gap-2 rounded-xl bg-oro px-5 text-[17px] font-bold text-tinta hover:bg-oro-400"
        >
          <Star size={20} fill="currentColor" aria-hidden /> Destacar este tardeo
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center gap-4 rounded-2xl border border-linea bg-white p-5 text-left shadow-tarjeta transition hover:border-linea-fuerte"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><Megaphone size={24} aria-hidden /></span>
          <span className="flex-1">
            <span className="block text-[17px] font-bold leading-tight">Promociona tus tardeos</span>
            <span className="text-[15px] text-tinta-suave">Pide que salgan destacados en la portada</span>
          </span>
          <ChevronRight size={20} className="text-tinta-suave" aria-hidden />
        </button>
      )}

      <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo={titulo ? `Destacar «${titulo}»` : "Destacar un tardeo"}>
        <ContactoDestacar titulo={titulo} />
      </Hoja>
    </>
  );
}
