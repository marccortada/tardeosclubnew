import { redirect } from "next/navigation";

/** El directorio de colaboradores es ahora /directorio (v2). Se conserva la
 *  pestaña (?ver=djs|promotores): sin ella, los enlaces viejos a DJs caían en Locales. */
export default async function Colaboradores({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ver } = await searchParams;
  redirect(ver === "djs" || ver === "promotores" ? `/directorio?ver=${ver}` : "/directorio");
}
