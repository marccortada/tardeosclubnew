import Image from "next/image";

// El sello real es 2048x1392 (ratio ~1.47). Respetamos la proporción.
const RATIO = 2048 / 1392;

export default function Sello({ size = 56 }: { size?: number }) {
  return (
    <Image
      src="/branding/sello.png"
      alt="Recomendado por TardeosClub"
      width={Math.round(size * RATIO)}
      height={size}
      className="drop-shadow-md"
      style={{ height: size, width: "auto" }}
    />
  );
}
