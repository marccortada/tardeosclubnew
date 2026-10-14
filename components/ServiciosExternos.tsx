import { Palette, TrendingUp, Globe, Megaphone, Video, Clapperboard, MessageCircle } from "lucide-react";
import { RESPONSABLE } from "@/lib/legal";

// Número de WhatsApp de TardeosClub (con código de país, sin + ni espacios)
export const WHATSAPP_TARDEOS = "34623787504";

/** Enlace a WhatsApp de TardeosClub con el mensaje ya escrito. */
export const whatsappTardeos = (texto: string) =>
  `https://wa.me/${WHATSAPP_TARDEOS}?text=${encodeURIComponent(texto)}`;

/** Lo mismo por email, para quien no usa WhatsApp en el ordenador. */
export const emailTardeos = (asunto: string, cuerpo: string) =>
  `mailto:${RESPONSABLE.emailContacto}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

const SERVICIOS = [
  { icon: Palette, label: "Branding", desc: "Logo, identidad y diseño de marca" },
  { icon: TrendingUp, label: "Posicionamiento digital (SEO)", desc: "Aparece arriba en Google" },
  { icon: Globe, label: "Página web", desc: "Web profesional para tu negocio" },
  { icon: Megaphone, label: "Publicidad", desc: "Campañas en redes e Instagram" },
  { icon: Video, label: "Vídeos con dron", desc: "Imágenes aéreas de tus eventos" },
  { icon: Clapperboard, label: "Audiovisuales", desc: "Intros y visuales para las pantallas de cabina" },
];

export default function ServiciosExternos({
  tipo = "local", className = "mt-8",
}: { tipo?: "local" | "dj"; /** Margen exterior: el panel del DJ lo pone debajo de otras secciones. */ className?: string }) {
  const contexto = tipo === "dj" ? "mi perfil de DJ" : "mi local";

  return (
    <section className={className}>
      <h2 className="text-xl font-bold">Servicios para tu negocio</h2>
      <p className="mb-3 mt-1 text-[15px] text-tinta-suave">
        En colaboración con{" "}
        <a href="https://gnerai.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-magenta-700 underline underline-offset-2">Gnerai</a>
        . Pide información por WhatsApp, sin compromiso.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICIOS.map(({ icon: Icon, label, desc }) => (
          <a
            key={label}
            href={whatsappTardeos(`Hola, me gustaría más información sobre el servicio de ${label} para ${contexto}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-[72px] items-center gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta transition hover:border-linea-fuerte"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
              <Icon size={22} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold leading-tight">{label}</span>
              <span className="text-[15px] text-tinta-suave">{desc}</span>
            </span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white" aria-hidden>
              <MessageCircle size={20} fill="currentColor" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
