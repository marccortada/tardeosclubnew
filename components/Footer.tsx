import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-black/5 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Image src="/branding/logo-transp.png" alt="TardeosClub" width={150} height={90} className="h-12 w-auto" />
            <p className="mt-2 font-script text-xl text-magenta-600">Sal, conecta y vive el tardeo</p>
            <p className="mt-1 text-sm font-semibold text-tinta/60">Tu comunidad tardícola.</p>
          </div>

          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm font-bold text-tinta/70">
            <Link href="/tardeos" className="transition hover:text-magenta">Tardeos</Link>
            <Link href="/mapa" className="transition hover:text-magenta">Mapa</Link>
            <Link href="/favoritos" className="transition hover:text-magenta">Mis planes</Link>
            <Link href="/perfil" className="transition hover:text-magenta">Entrar / Únete</Link>
            <Link href="/perfil" className="transition hover:text-magenta">Soy un local</Link>
            <Link href="/perfil" className="transition hover:text-magenta">Soy DJ</Link>
          </nav>
        </div>

        {/* Powered by / Socios */}
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-black/5 pt-6 sm:flex-row sm:justify-center">
          <span className="text-xs font-bold uppercase tracking-wide text-tinta/40">Powered by</span>
          <a
            href="https://gnerai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center transition hover:opacity-70"
            aria-label="Gnerai"
          >
            <Image src="/branding/gnerailogo.png" alt="Gnerai" width={32} height={32} className="h-8 w-8" />
          </a>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-black/5 pt-6 text-xs font-semibold text-tinta/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 TardeosClub · Costa de Catalunya</p>
          <div className="flex gap-4">
            <Link href="/legal/aviso-legal" className="transition hover:text-magenta">Aviso legal</Link>
            <Link href="/legal/privacidad" className="transition hover:text-magenta">Privacidad</Link>
            <Link href="/legal/cookies" className="transition hover:text-magenta">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
