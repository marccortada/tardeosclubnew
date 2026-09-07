import { supabase } from "./supabase";
import { registrar } from "./registro";

/**
 * El ADN del tardícola: los mismos criterios con los que se describe un tardeo,
 * pero en forma de preferencia.
 *
 * La cardinalidad NO es la misma que en el evento, y conviene tenerlo claro:
 *
 *   criterio        en el tardeo            en el tardícola
 *   música          un estilo               varios ("me gusta house Y latino")
 *   ambiente        varios                  varios
 *   tipo de evento  uno                     varios
 *   público         franjas a las que apunta UNA: es su edad, no un gusto
 *   dress code      uno                     varios
 *   zona            una (donde se celebra)  varias (por donde se mueve)
 *   precio          un importe              UN tope
 *
 * Con esto se puede cruzar persona ↔ evento para recomendar y para segmentar
 * los avisos, que es de lo que va la sección 3 del documento.
 */
export type AdnTardicola = {
  /** Ids de estilo de lib/musica (`electronica:afro house`) o de familia. */
  musica: string[];
  ambiente: string[];
  tiposEvento: string[];
  dressCodes: string[];
  zonas: string[];
  /** Su franja de edad. Una sola. */
  publico: string;
  /** Clave del tramo de precio que se puede permitir (los de ListaTardeos). */
  precioMax: string;
  /** Cuándo lo rellenó. null = nunca. */
  rellenadoEn: string | null;
};

export const ADN_VACIO: AdnTardicola = {
  musica: [], ambiente: [], tiposEvento: [], dressCodes: [], zonas: [],
  publico: "", precioMax: "", rellenadoEn: null,
};

const COLUMNAS = "musica,ambiente,tipos_evento,dress_codes,zonas,publico,precio_max,adn_en";

/**
 * El ADN de un usuario.
 *
 * Devuelve null solo si la consulta falla, y lo deja en el log. Vacío (todo a
 * cero) significa "no lo ha rellenado", que es distinto de "no se pudo leer":
 * si se confundieran, un fallo de red le volvería a pedir los gustos a alguien
 * que ya los dio. Es la misma trampa que duplicó locales y perfiles de DJ.
 */
export async function getAdn(profileId: string): Promise<AdnTardicola | null> {
  const { data, error } = await supabase
    .from("profiles").select(COLUMNAS).eq("id", profileId).maybeSingle();
  if (error) {
    registrar("adn", "no se pudo leer el perfil de gustos", error);
    return null;
  }
  if (!data) return { ...ADN_VACIO };
  return {
    musica: data.musica ?? [],
    ambiente: data.ambiente ?? [],
    tiposEvento: data.tipos_evento ?? [],
    dressCodes: data.dress_codes ?? [],
    zonas: data.zonas ?? [],
    publico: data.publico ?? "",
    precioMax: data.precio_max ?? "",
    rellenadoEn: data.adn_en ?? null,
  };
}

/** ¿Ha dicho ya lo que le gusta? Con un solo criterio ya se puede recomendar. */
export function tieneAdn(adn: AdnTardicola | null): boolean {
  if (!adn) return false;
  return Boolean(
    adn.musica.length || adn.ambiente.length || adn.tiposEvento.length ||
    adn.dressCodes.length || adn.zonas.length || adn.publico || adn.precioMax
  );
}

/**
 * Guarda el ADN.
 *
 * Las listas vacías se guardan como null y no como `[]`, igual que en el
 * tardeo: así "no me preguntes por esto" se distingue de "lo miré y no elegí".
 */
export async function guardarAdn(profileId: string, adn: AdnTardicola) {
  const oNull = (v: string[]) => (v.length ? v : null);
  return supabase
    .from("profiles")
    .update({
      musica: oNull(adn.musica),
      ambiente: oNull(adn.ambiente),
      tipos_evento: oNull(adn.tiposEvento),
      dress_codes: oNull(adn.dressCodes),
      zonas: oNull(adn.zonas),
      publico: adn.publico || null,
      precio_max: adn.precioMax || null,
      adn_en: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("id");
}
