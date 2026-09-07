import { supabase } from "./supabase";

export type Resena = {
  id: string;
  puntuacion: number;
  comentario: string | null;
  created_at: string;
  autor_profile_id?: string;
  objetivo_tipo?: string;
  objetivo_id?: string;
  estado?: "pendiente" | "aprobada" | "rechazada" | "apelada";
  /** Por qué se rechazó (lote 44). Se le enseña a quien la escribió. */
  motivo_rechazo?: string | null;
  /** Lo que alega el autor si no está de acuerdo. */
  apelacion?: string | null;
  apelada_en?: string | null;
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

/*
 * Aquí vivía `yaReseno()`, que preguntaba al navegador si esta persona ya
 * había reseñado este sitio. Se ha quitado, no movido: esa comprobación no
 * era un límite —dos pestañas abiertas y entraban las dos— y ahora la hace un
 * índice único en la base (lote 44). Quien necesite saberlo, use `miResena`,
 * que además dice en qué estado está.
 */

// --- Admin ---

/**
 * La cola: lo pendiente y lo apelado.
 *
 * Las apeladas van con lo pendiente porque son lo mismo —algo que hay que
 * mirar— y tenerlas en otra pantalla es garantizar que nadie las mire.
 */
export async function getResenasPendientes(): Promise<Resena[]> {
  const { data } = await supabase
    .from("resenas")
    .select("id,puntuacion,comentario,created_at,estado,objetivo_tipo,objetivo_id,motivo_rechazo,apelacion,apelada_en,profiles:autor_profile_id(display_name)")
    .in("estado", ["pendiente", "apelada"])
    // Las apeladas primero: llevan más tiempo esperando que las nuevas.
    .order("estado", { ascending: true })
    .order("created_at", { ascending: false });
  return (data as unknown as Resena[]) ?? [];
}

/**
 * Aprobar o rechazar. Al rechazar hace falta un motivo, y no es burocracia:
 * es lo único que quien la escribió va a poder leer.
 *
 * Se mira lo que DEVUELVE y no solo si hay error: con seguridad de fila, un
 * update que no alcanza ninguna fila responde bien sin haber escrito nada, y
 * la cola se vaciaría en pantalla sin haberse moderado.
 */
export async function moderarResena(
  id: string,
  aprobar: boolean,
  motivo?: MotivoRechazo
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("resenas")
    .update({
      estado: aprobar ? "aprobada" : "rechazada",
      motivo_rechazo: aprobar ? null : (motivo ?? "otro"),
    })
    .eq("id", id)
    .select("id,estado");
  if (error) {
    const falta = error.code === "42703" || error.code === "PGRST204";
    return { ok: false, error: falta ? "Falta pegar el lote 44 (supabase/44_resenas_moderacion.sql)." : error.message };
  }
  if (!data?.length) return { ok: false, error: "No se guardó. ¿Tu cuenta es admin?" };
  return { ok: true };
}

// --- Autor ---

/** La reseña de esta persona sobre este objetivo, en cualquier estado. */
export async function miResena(uid: string, tipo: "local" | "dj", id: string): Promise<Resena | null> {
  const { data } = await supabase
    .from("resenas")
    .select("id,puntuacion,comentario,created_at,estado,objetivo_tipo,objetivo_id,motivo_rechazo,apelacion")
    .eq("autor_profile_id", uid).eq("objetivo_tipo", tipo).eq("objetivo_id", id)
    .maybeSingle();
  return (data as unknown as Resena) ?? null;
}

/**
 * Apelar un rechazo.
 *
 * La base solo deja pasar esto sobre una reseña propia y rechazada, y un
 * disparador devuelve a su sitio la puntuación y el comentario: sin eso, se
 * apelaría una reseña y se colaría otra distinta, que es justo lo que se está
 * discutiendo.
 */
export async function apelarResena(id: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const t = texto.trim().slice(0, 500);
  if (!t) return { ok: false, error: "Cuéntanos por qué crees que hay un error." };
  const { data, error } = await supabase
    .from("resenas")
    .update({ estado: "apelada", apelacion: t })
    .eq("id", id)
    .select("id,estado");
  if (error) return { ok: false, error: "No se pudo enviar. Inténtalo en un momento." };
  if (!data?.length) return { ok: false, error: "Esta reseña ya no se puede apelar." };
  return { ok: true };
}
