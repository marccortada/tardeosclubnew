"use client";

import { supabase } from "./supabase";

/**
 * Denunciar un flyer, y la cola para resolverlo (lote 42).
 *
 * Los flyers los suben los locales sin que nadie los mire antes y salen a
 * tamaño completo en la portada. Hasta ahora la única forma de avisar de uno
 * ilegible u ofensivo era escribir un email.
 */

export const MOTIVOS = [
  { k: "ilegible", label: "No se lee bien", ayuda: "Está borroso, cortado o con el texto ilegible." },
  { k: "no_corresponde", label: "No es de este tardeo", ayuda: "La imagen no tiene que ver con lo que anuncia." },
  { k: "ofensivo", label: "Contenido inapropiado", ayuda: "Ofensivo, sexual o violento." },
  { k: "derechos", label: "Usa material de otro", ayuda: "Fotos o diseños sin permiso." },
  { k: "otro", label: "Otra cosa", ayuda: "Cuéntanoslo abajo." },
] as const;

export type Motivo = (typeof MOTIVOS)[number]["k"];

export type Denuncia = {
  id: string;
  tardeo_id: string;
  motivo: Motivo;
  mensaje: string | null;
  flyer_url: string | null;
  estado: "pendiente" | "retirado" | "desestimado";
  created_at: string;
  tardeos?: { titulo: string; fecha: string; flyer_url: string | null; local_id: string } | null;
};

/**
 * Manda una denuncia.
 *
 * `flyerUrl` se guarda AQUÍ y no se deduce después: es la imagen que vio quien
 * denuncia. Si el local la cambia mañana, la denuncia tiene que seguir
 * apuntando a la que se reportó, o quien la revise no verá nunca lo que pasó.
 */
export async function denunciarFlyer(
  tardeoId: string,
  motivo: Motivo,
  mensaje: string,
  flyerUrl: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from("denuncias_flyer").insert({
    tardeo_id: tardeoId,
    denunciante: session?.user?.id ?? null,
    motivo,
    mensaje: mensaje.trim().slice(0, 500) || null,
    flyer_url: flyerUrl,
  });
  if (!error) return { ok: true };
  // 23505 = ya hay una pendiente suya sobre este tardeo. No es un fallo: para
  // quien denuncia el resultado es el mismo, ya está avisado.
  if (error.code === "23505") return { ok: true };
  // 42P01 = la tabla no existe todavía (lote 42 sin pegar).
  if (error.code === "42P01") return { ok: false, error: "Falta pegar el lote 42 (supabase/42_denuncias_flyer.sql)." };
  return { ok: false, error: "No se pudo enviar. Inténtalo en un momento." };
}

/** La cola del admin: pendientes primero, las más nuevas arriba. */
export async function denunciasPendientes(): Promise<{ filas: Denuncia[]; error: string | null }> {
  const { data, error } = await supabase
    .from("denuncias_flyer")
    .select("id,tardeo_id,motivo,mensaje,flyer_url,estado,created_at,tardeos(titulo,fecha,flyer_url,local_id)")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false });
  if (error) {
    const falta = error.code === "42P01" || error.code === "PGRST205";
    return { filas: [], error: falta ? "Falta pegar el lote 42 (supabase/42_denuncias_flyer.sql)." : error.message };
  }
  return { filas: (data ?? []) as unknown as Denuncia[], error: null };
}

/**
 * Resolver una denuncia. Quién y cuándo lo sella la base (lote 42), no esto.
 *
 * Se mira lo que DEVUELVE y no solo si hay error: con seguridad de fila, un
 * update que no alcanza ninguna fila responde correctamente y sin escribir
 * nada, y la cola se vaciaría en pantalla sin haberse resuelto.
 */
export async function resolverDenuncia(
  id: string,
  estado: "retirado" | "desestimado",
  nota: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("denuncias_flyer")
    .update({ estado, nota_resolucion: nota.trim() || null })
    .eq("id", id)
    .select("id,estado");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No se guardó. ¿Tu cuenta es admin?" };
  return { ok: true };
}
