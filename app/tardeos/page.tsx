import { redirect } from "next/navigation";

/** /tardeos pasa a /eventos (v2) conservando los parámetros (?q, ?zona, ?cuando…). */
export default async function Tardeos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") p.set(k, v);
  if (p.get("cuando") === "semana") p.delete("cuando");
  if (p.has("filtros")) p.delete("filtros");
  const qs = p.toString();
  redirect(`/eventos${qs ? `?${qs}` : ""}`);
}
