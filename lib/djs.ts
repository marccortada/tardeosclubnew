import { supabase } from "./supabase";

export type Contenido = {
  id: string;
  dj_id: string;
  tipo: "sesion" | "video" | "foto" | "flyer";
  titulo: string | null;
  url: string;
  created_at: string;
};

export const TIPOS_CONTENIDO = [
  { k: "sesion", label: "Sesión / mix", pie: "SoundCloud, Mixcloud…" },
  { k: "video", label: "Vídeo", pie: "YouTube, Instagram…" },
  { k: "flyer", label: "Flyer", pie: "De una fiesta suya" },
  { k: "foto", label: "Foto", pie: "De cabina o de directo" },
] as const;

/** Lo que ha subido un DJ, lo último primero. */
export async function getContenidos(djId: string): Promise<Contenido[]> {
  const { data, error } = await supabase
    .from("dj_contenidos").select("*").eq("dj_id", djId)
    .order("created_at", { ascending: false });
  if (error) console.error("[djs] no se pudo cargar el contenido:", error.message);
  return (data as Contenido[]) ?? [];
}

export async function anadirContenido(djId: string, tipo: string, url: string, titulo: string) {
  return supabase.from("dj_contenidos").insert({
    dj_id: djId, tipo, url: url.trim(), titulo: titulo.trim() || null,
  }).select("id");
}

export async function borrarContenido(id: string) {
  return supabase.from("dj_contenidos").delete().eq("id", id);
}

/**
 * Sube una foto o un flyer del DJ y devuelve su URL.
 *
 * Al bucket `flyers`, que ya es público y ya se usa para todo lo demás: un
 * bucket por tipo de imagen es un permiso más que mantener sin ganar nada.
 */
export async function subirImagenDj(djId: string, file: File): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ruta = `djs/${djId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("flyers").upload(ruta, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) { console.error("[djs] no se pudo subir la imagen:", error.message); return null; }
  return supabase.storage.from("flyers").getPublicUrl(ruta).data.publicUrl;
}

/**
 * Convierte un enlace de YouTube o SoundCloud en algo incrustable.
 *
 * Devuelve null si no se reconoce, y entonces se enseña como enlace normal: es
 * mejor un enlace que funciona que un reproductor roto ocupando media pantalla.
 */
export function urlIncrustada(url: string): string | null {
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  if (/soundcloud\.com\//.test(u)) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23E10A5A&hide_related=true&show_comments=false`;
  }
  if (/mixcloud\.com\//.test(u)) {
    return `https://player-widget.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(u)}&hide_cover=1`;
  }
  return null;
}
