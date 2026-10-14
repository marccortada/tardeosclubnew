"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

/** Sesión actual del usuario (login sin contraseña por email). */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mismo usuario → mismo objeto. La librería emite SIGNED_IN con un objeto
    // nuevo cada vez que la pestaña vuelve a estar visible (o al volver de la
    // cámara en Android): sin esto, todos los efectos que dependen de `user`
    // se relanzaban, los paneles volvían a "Cargando…" y se perdía lo que
    // estuvieras escribiendo.
    const poner = (u: User | null) => setUser((prev) => (prev?.id === u?.id ? prev : u));
    supabase.auth.getSession().then(({ data }) => {
      poner(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      poner(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
