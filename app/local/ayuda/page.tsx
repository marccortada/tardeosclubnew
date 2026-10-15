"use client";

import { MessageCircle, Mail } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import ServiciosExternos, { whatsappTardeos, emailTardeos } from "@/components/ServiciosExternos";
import { useFicha } from "../_panel/PanelLocal";

const PREGUNTAS = [
  {
    p: "¿Cómo publico un tardeo rápido?",
    r: "En «Crear tardeo» sube el flyer y pulsa «Analizar con IA»: rellenamos título, fecha, hora y DJ. Revisa lo marcado y publica.",
  },
  {
    p: "¿Por qué no veo mi tardeo en la web?",
    r: "Si tu ficha está pendiente de revisar, tus tardeos se guardan y salen con ella. También puede estar programado o guardado como borrador: míralo en «Mis tardeos».",
  },
  {
    p: "¿Dónde pongo el enlace para comprar entradas?",
    r: "Al crear o editar el tardeo, en «Entradas»: pega el enlace de Fourvenues o de la ticketera que uses. El botón del tardeo llevará ahí.",
  },
  {
    p: "¿Cómo sé quién viene?",
    r: "En los tardeos gratis la gente se apunta con un botón. Lo ves en «Apuntados» y puedes descargarlo en CSV para la puerta.",
  },
  {
    p: "¿Cuesta algo?",
    r: "No. Publicar es gratis y desde la web no se cobra nada.",
  },
];

/** Ayuda corta y contacto directo con TardeosClub, más los servicios de Gnerai. */
export default function Ayuda() {
  const { ficha } = useFicha();
  const hola = `Hola, soy de ${ficha.nombre} y tengo una duda con mi panel de TardeosClub.`;
  return (
    <SeccionPanel titulo="Ayuda y servicios" descripcion="Respuestas rápidas y cómo hablar con nosotros.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <h2 className="mb-3 text-xl font-bold">Preguntas frecuentes</h2>
          <div className="flex flex-col gap-2">
            {PREGUNTAS.map(({ p, r }) => (
              <details key={p} className="group rounded-2xl border border-linea bg-white shadow-tarjeta">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-[16px] font-bold">
                  {p} <span className="text-xl text-tinta-suave transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="px-4 pb-4 text-[15px] text-tinta-suave">{r}</p>
              </details>
            ))}
          </div>
        </section>
        <aside className="h-fit rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
          <h2 className="text-lg font-bold">¿Hablamos?</h2>
          <p className="mt-1 text-[15px] text-tinta-suave">Te respondemos personas del equipo de TardeosClub.</p>
          <div className="mt-4 flex flex-col gap-2">
            <a href={whatsappTardeos(hola)} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-tacto items-center justify-center gap-2 rounded-xl bg-[#1DA851] px-5 text-[17px] font-bold text-white hover:brightness-95">
              <MessageCircle size={20} aria-hidden /> WhatsApp
            </a>
            <a href={emailTardeos(`Duda de ${ficha.nombre}`, hola)}
              className="inline-flex min-h-tacto items-center justify-center gap-2 rounded-xl border border-linea-fuerte bg-white px-5 text-[17px] font-bold hover:bg-marfil-100">
              <Mail size={20} aria-hidden /> Email
            </a>
          </div>
        </aside>
      </div>
      <ServiciosExternos tipo="local" />
    </SeccionPanel>
  );
}
