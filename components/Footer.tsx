import Image from "next/image";
import Link from "next/link";
import ReportarProblema from "@/components/ReportarProblema";

const COLUMNAS: { titulo: string; enlaces: { href: string; label: string; externo?: boolean }[] }[] = [
  {
    titulo: "Descubre",
    enlaces: [
      { href: "/eventos", label: "Todos los tardeos" },
      { href: "/eventos?cuando=hoy", label: "Tardeos de hoy" },
      { href: "/eventos?cuando=finde", label: "Este finde" },
      { href: "/eventos?vista=mapa", label: "Mapa" },
      { href: "/directorio", label: "Locales y DJs" },
      { href: "https://chat.whatsapp.com/KMAxRPoj36w6cOSGGwnZhi?mode=ems_wa_c", label: "Comunidad de WhatsApp", externo: true },
    ],
  },
  {
    titulo: "Tu cuenta",
    enlaces: [
      { href: "/perfil", label: "Entrar o crear cuenta" },
      { href: "/proxima-parada", label: "Próxima Parada" },
      { href: "/perfil/adn", label: "Mi ADN" },
    ],
  },
  {
    titulo: "Colabora",
    // A /unirse con el rol puesto: antes los tres apuntaban a /perfil, a un
    // login que no decía para qué.
    enlaces: [
      { href: "/unirse?rol=local", label: "Soy un local o evento" },
      { href: "/unirse?rol=dj", label: "Soy DJ" },
    ],
  },
];

/**
 * Pie de la web pública. Oscuro, como el de tardeosclub.com: cierra la página
 * con peso y separa claramente el contenido de la letra pequeña.
 *
 * Va sobre `bg-noche` (fijo) y no `bg-tinta`: tinta se aclara en modo oscuro
 * y el pie quedaba blanco con letra blanca. Por lo mismo las placas blancas
 * del logo son `bg-[#fff]`: `.dark .bg-white` las volvería oscuras.
 *
 * El relleno de abajo en el móvil deja sitio a la barra de navegación fija,
 * que si no tapaba los enlaces legales.
 */
export default function Footer() {
  return (
    <footer className="mt-16 bg-noche text-white">
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-12 md:px-8 md:pb-10">
        <div className="grid gap-8 md:grid-cols-[1.2fr_2fr]">
          <div className="max-w-xs">
            {/* El logo va sobre una placa blanca: tiene partes oscuras que
                sobre el fondo negro se perderían. */}
            <span className="inline-block rounded-2xl bg-[#fff] px-3 py-2">
              <Image src="/branding/logo-transp.png" alt="TardeosClub" width={150} height={90} className="h-11 w-auto" />
            </span>
            <p className="mt-4 font-display text-[22px] font-bold leading-snug">
              Los tardeos de la costa de Catalunya, en un solo sitio.
            </p>
          </div>

          <nav aria-label="Pie de página" className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {COLUMNAS.map((c) => (
              <div key={c.titulo}>
                <p className="text-[13px] font-bold uppercase tracking-wider text-oro">{c.titulo}</p>
                <ul className="mt-2 flex flex-col">
                  {c.enlaces.map((e) => (
                    <li key={e.href}>
                      {e.externo ? (
                        <a href={e.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-[15px] font-medium text-white/90 transition hover:text-oro">
                          {e.label}
                        </a>
                      ) : (
                        <Link href={e.href} className="inline-flex min-h-[44px] items-center text-[15px] font-medium text-white/90 transition hover:text-oro">
                          {e.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/15 pt-6 text-[14px] text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TardeosClub · Costa de Catalunya</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/legal/aviso-legal" className="min-h-[44px] content-center transition hover:text-white">Aviso legal</Link>
            <Link href="/legal/privacidad" className="min-h-[44px] content-center transition hover:text-white">Privacidad</Link>
            <Link href="/legal/cookies" className="min-h-[44px] content-center transition hover:text-white">Cookies</Link>
            <ReportarProblema etiqueta="Avisar de un problema" className="min-h-[44px] content-center text-left transition hover:text-white" />
            <a href="https://gnerai.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 transition hover:opacity-70">
              <span className="text-[13px] font-semibold uppercase tracking-wide">Powered by</span>
              <Image src="/branding/gnerailogo.png" alt="Gnerai" width={28} height={28} className="h-7 w-7 rounded bg-[#fff] p-0.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
