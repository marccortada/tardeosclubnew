import Image from "next/image";

export default function Header({ subtitulo }: { subtitulo?: string }) {
  return (
    <header className="flex flex-col items-center pt-6 pb-2">
      <Image src="/branding/logo-transp.png" alt="TardeosClub" width={190} height={120} priority className="h-auto w-[170px]" />
      {subtitulo && (
        <p className="mt-1 text-center text-sm font-bold text-tinta/60">{subtitulo}</p>
      )}
    </header>
  );
}
