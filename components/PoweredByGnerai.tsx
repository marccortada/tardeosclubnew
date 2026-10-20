import Image from "next/image";

/**
 * Firma «Powered by GNERAI» con su logo, enlazada a gnerai.com: va en todas las
 * webs del estudio. Una sola pieza para que salga igual en el pie público, en los
 * paneles y en Perfil (la página de mantenimiento del servidor lleva la misma,
 * escrita en su HTML). El logo lleva fondo blanco propio: se ve en claro y oscuro.
 */
export default function PoweredByGnerai({ className = "" }: { className?: string }) {
  return (
    <a href="https://gnerai.com" target="_blank" rel="noopener noreferrer" aria-label="Powered by GNERAI"
      className={`inline-flex min-h-[44px] items-center gap-2 transition hover:opacity-70 ${className}`}>
      <span className="text-[13px] font-semibold uppercase tracking-wide">Powered by</span>
      <Image src="/branding/gnerailogo.png" alt="" width={28} height={28} className="h-7 w-7 rounded bg-[#fff] p-0.5" />
    </a>
  );
}
