import { supabase } from "./supabase";

export type Resena = {
  id: string;
  puntuacion: number;
  comentario: string | null;
  created_at: string;
  autor_profile_id?: string;
  objetivo_tipo?: string;
  objetivo_id?: string;
  profiles?: { display_name: string | null } | null;
};

/** Reseñas aprobadas de un objetivo (local o dj). */
export async function getResenasAprobadas(tipo: "local" | "dj", id: string): Promise<Resena[]> {
  const { data } = await supabase
    .from("resenas")
    .select("id,puntuacion,comentario,created_at,profiles:autor_profile_id(display_name)")
    .eq("objetivo_tipo", tipo)
    .eq("objetivo_id", id)
    .eq("estado", "aprobada")
    .order("created_at", { ascending: false });
  return (data as unknown as Resena[]) ?? [];
}

export async function crearResena(uid: string, tipo: "local" | "dj", id: string, puntuacion: number, comentario: string) {
  return supabase.from("resenas").insert({
    autor_profile_id: uid,
    objetivo_tipo: tipo,
    objetivo_id: id,
    puntuacion,
    comentario: comentario.trim() || null,
  });
}

/** ¿el usuario ya reseñó este objetivo? (para no duplicar) */
export async function yaReseno(uid: string, tipo: "local" | "dj", id: string): Promise<boolean> {
  const { data } = await supabase
    .from("resenas").select("id")
    .eq("autor_profile_id", uid).eq("objetivo_tipo", tipo).eq("objetivo_id", id)
    .maybeSingle();
  return !!data;
}

// --- Admin ---
export async function getResenasPendientes(): Promise<Resena[]> {
  const { data } = await supabase
    .from("resenas")
    .select("id,puntuacion,comentario,created_at,objetivo_tipo,objetivo_id,profiles:autor_profile_id(display_name)")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false });
  return (data as unknown as Resena[]) ?? [];
}
export async function moderarResena(id: string, aprobar: boolean) {
  return supabase.from("resenas").update({ estado: aprobar ? "aprobada" : "rechazada" }).eq("id", id);
}
