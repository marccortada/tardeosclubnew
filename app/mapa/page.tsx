import { redirect } from "next/navigation";

/** El mapa vive dentro de Eventos (v2). Se conservan los parámetros. */
export default async function Mapa({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") p.set(k, v);
  p.set("vista", "mapa");
  redirect(`/eventos?${p.toString()}`);
}
