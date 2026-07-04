import { Palette, TrendingUp, Globe, Megaphone, Video, Clapperboard, MessageCircle } from "lucide-react";

// Número de WhatsApp de TardeosClub (con código de país, sin + ni espacios)
const WHATSAPP = "34623787504";

const SERVICIOS = [
  { icon: Palette, label: "Branding", desc: "Logo, identidad y diseño de marca" },
  { icon: TrendingUp, label: "Posicionamiento digital (SEO)", desc: "Aparece arriba en Google" },
  { icon: Globe, label: "Página web", desc: "Web profesional para tu negocio" },
  { icon: Megaphone, label: "Publicidad", desc: "Campañas en redes e Instagram" },
  { icon: Video, label: "Vídeos con dron", desc: "Imágenes aéreas de tus eventos" },
  { icon: Clapperboard, label: "Audiovisuales", desc: "Intros y visuales para las pantallas de cabina" },
];

export default function ServiciosExternos({ tipo = "local" }: { tipo?: "local" | "dj" }) {
  const contexto = tipo === "dj" ? "mi perfil de DJ" : "mi local";

  return (
    <section className="mt-7">
      <h2 className="font-display text-xl font-black md:text-2xl">Servicios para tu negocio</h2>
      <p className="mb-3 text-sm font-semibold text-tinta/60">
        En colaboración con{" "}
        <a href="https://gnerai.com" target="_blank" rel="noopener noreferrer" className="font-black text-magenta underline underline-offset-2">Gnerai</a>
        . ¿Quieres crecer? Escríbenos por WhatsApp.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICIOS.map(({ icon: Icon, label, desc }) => {
          const texto = encodeURIComponent(`Hola, me gustaría más información sobre el servicio de ${label} para ${contexto}.`);
          return (
            <a
              key={label}
              href={`https://wa.me/${WHATSAPP}?text=${texto}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
                <Icon size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black leading-tight">{label}</span>
                <span className="text-sm font-semibold text-tinta/60">{desc}</span>
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white transition group-hover:scale-105">
                <MessageCircle size={20} fill="currentColor" />
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
