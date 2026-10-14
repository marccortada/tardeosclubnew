import { supabase } from "@/lib/supabase";

/**
 * Pide al servidor rehacer portada, /tardeos y mapa. Sin esto, quien acaba de
 * cambiar algo mira la portada y no lo ve hasta que caduca la caché (1 min).
 * No es crítico: si falla, se refresca solo.
 */
export async function refrescarPortada(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/revalidar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session?.access_token }),
    });
  } catch { /* no crítico */ }
}
