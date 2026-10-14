import { supabase } from "@/lib/supabase";
import { reducirImagen } from "./reducirImagen";

/** Lo que devuelve /api/leer-flyer (ver su esquema). */
export type LecturaFlyer = {
  titulo: string; fecha: string; horaInicio: string; horaFin: string; dj: string; estilo: string;
  tipoEntrada: "gratis" | "pago" | "lista"; precio: string; revisar: string[];
};

const aBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]); // sin el prefijo data:
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/** Manda el flyer a la IA y devuelve lo leído. Lanza con un mensaje legible. */
export async function leerFlyerConIA(original: File): Promise<LecturaFlyer> {
  // Reducida: una foto de móvil entera puede pasarse del límite de la API.
  const file = await reducirImagen(original);
  const imageBase64 = await aBase64(file);
  const { data: { session } } = await supabase.auth.getSession();
  let res: Response;
  try {
    res = await fetch("/api/leer-flyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mediaType: file.type, accessToken: session?.access_token }),
    });
  } catch {
    throw new Error("Sin conexión: no se pudo mandar el flyer a leer.");
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "No se pudo leer el flyer.");
  return j.data as LecturaFlyer;
}

/** Sube un flyer al bucket `flyers` y devuelve su URL pública, o null si falla. */
export async function subirFlyer(uid: string, original: File): Promise<string | null> {
  const file = await reducirImagen(original);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ruta = `${uid}/${Date.now()}.${ext}`;
  try {
    const { error } = await supabase.storage.from("flyers").upload(ruta, file, { contentType: file.type || "image/jpeg" });
    if (error) return null;
  } catch {
    return null;
  }
  return supabase.storage.from("flyers").getPublicUrl(ruta).data.publicUrl;
}
