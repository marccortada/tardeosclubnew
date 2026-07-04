import Image from "next/image";
import Link from "next/link";

export default function TopBar() {
  return (
    <div className="sticky top-0 z-[800] flex items-center justify-between bg-white/85 px-4 py-2.5 backdrop-blur-md">
      <Image src="/branding/logo-transp.png" alt="TardeosClub" width={120} height={70} priority className="h-11 w-auto" />
      <Link
        href="/perfil"
        className="rounded-full bg-marca px-4 py-2 text-sm font-extrabold text-white shadow-tarjeta active:scale-95 transition"
      >
        Entrar / Únete
      </Link>
    </div>
  );
}
