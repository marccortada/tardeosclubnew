import type { Metadata } from "next";
import { Suspense } from "react";
import NexoRadioPagina from "./NexoRadioPagina";

export const metadata: Metadata = {
  title: "Nexo Radio · TardeosClub",
  description: "El ritmo de tu tarde. Radio y comunidad musical.",
};

export default function PaginaNexo() {
  // La URL del stream es pública (NEXT_PUBLIC_): se lee en el servidor y se
  // pasa, así cambiarla no exige tocar código.
  const stream = process.env.NEXT_PUBLIC_NEXO_STREAM_URL?.trim() || null;
  return (
    <Suspense>
      <NexoRadioPagina stream={stream && /^https?:\/\//.test(stream) ? stream : null} />
    </Suspense>
  );
}
