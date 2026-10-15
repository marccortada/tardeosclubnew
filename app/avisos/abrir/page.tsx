"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { volverSeguro } from "@/lib/volver";

/**
 * Puente al tocar una notificación push (public/sw.js): marca ese aviso como
 * leído en la bandeja (con la sesión del navegador, que el service worker no
 * tiene) y lleva a su destino. Así la campana no sigue contando algo que la
 * persona ya abrió desde el móvil.
 */
export default function AbrirAviso() {
  const router = useRouter();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("id");
    // Solo rutas internas: un parámetro de URL nunca debe sacarnos de la web.
    const destino = volverSeguro(q.get("u")) ?? "/avisos";
    const ir = () => router.replace(destino);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) { ir(); return; }
    supabase.from("avisos").update({ leido_en: new Date().toISOString() }).eq("id", id).is("leido_en", null)
      .then(() => ir(), () => ir());
  }, [router]);
  return <p className="py-16 text-center text-tinta-suave">Abriendo…</p>;
}
