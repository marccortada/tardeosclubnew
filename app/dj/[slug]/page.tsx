import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { plegar } from "@/lib/texto";

/**
 * Los enlaces de DJ de la web actual, que aquí morían en un 404.
 *
 * `tardeosclub.com` usa `/dj/<algo>` y esta usa `/djs/<uuid>`. Alguien que
 * tenga guardado —o que le hayan pasado por WhatsApp—
 * `tardeosclub.com/dj/basi-de-la-fuente-original` abre la web nueva y ve una
 * página que no existe. Es exactamente el «cambio a peor» que no puede pasar
 * el día del lanzamiento, y no es una función que falte: es una que estaba.
 *
 * En la web actual el identificador viene de dos formas —el uuid pelado, o el
 * nombre convertido en texto con a veces un trozo de id detrás
 * («joan-gel-167e245a»)— y aquí se resuelven las dos.
 *
 * Si no se reconoce, se cae al directorio en vez de a un 404: quien buscaba un
 * DJ concreto al menos llega a la lista de DJs y lo encuentra a mano. Un 404
 * es un callejón sin salida.
 */
export const dynamic = "force-dynamic";

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El nombre convertido en texto de URL, igual que lo hacía la web actual. */
const aTexto = (s: string) =>
  plegar(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default async function DjCompatibilidad({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pedido = decodeURIComponent(slug ?? "").toLowerCase();

  if (ES_UUID.test(pedido)) redirect(`/djs/${pedido}`);

  const { data } = await supabase.from("djs").select("id,nombre_artistico").eq("oculto", false);

  const djs = (data ?? []).map((d) => ({ id: String(d.id).toLowerCase(), t: aTexto(d.nombre_artistico ?? "") }));
  // Con `find` ganaba el primero que encajase: «dj» se quedaba enlaces de
  // «dj-pepe-…». Se busca de lo más seguro a lo menos:
  // 1) el nombre exacto;
  // 2) el trozo final coincide con el inicio de un id (lo que añadía la web
  //    actual para distinguir DJs con el mismo nombre); si hay varios, el que
  //    además encaje por nombre;
  // 3) el nombre más largo que encaje como prefijo.
  const trozo = pedido.includes("-") ? pedido.slice(pedido.lastIndexOf("-") + 1) : "";
  const encajaNombre = (t: string) => t.length > 0 && pedido.startsWith(`${t}-`);
  const porId = /^[0-9a-f]{4,}$/.test(trozo) ? djs.filter((d) => d.id.startsWith(trozo)) : [];
  const encontrado =
    djs.find((d) => d.t.length > 0 && d.t === pedido) ??
    porId.find((d) => encajaNombre(d.t)) ??
    (porId.length === 1 ? porId[0] : undefined) ??
    djs.filter((d) => encajaNombre(d.t)).sort((a, b) => b.t.length - a.t.length)[0];

  redirect(encontrado ? `/djs/${encontrado.id}` : "/colaboradores?ver=djs");
}
