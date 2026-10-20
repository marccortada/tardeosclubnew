import Image from "next/image";
import { MARCA } from "@/lib/marca";

export default function Header({ subtitulo }: { subtitulo?: string }) {
  return (
    <header className="flex flex-col items-center pb-2 pt-6">
      <Image src="/branding/logo-transp.png" alt={MARCA.nombre} width={190} height={120} priority className="h-auto w-[160px]" />
      {subtitulo && <p className="mt-1 text-center text-[15px] font-medium text-tinta-suave">{subtitulo}</p>}
    </header>
  );
}
