"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { Loader2, ShieldAlert } from "lucide-react";

/**
 * Guardia única para todo /admin.
 *
 * Los datos ya los protege RLS, pero sin esto cualquiera podía abrir las
 * pantallas de administración y ver los controles (verificar, ocultar,
 * asignar dueño) aunque al pulsarlos fallaran. Antes solo /admin comprobaba
 * el rol; las subpáginas estaban a la vista.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setIsAdmin(false); return; }
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(!!data?.is_admin));
  }, [user, loading]);

  if (loading || isAdmin === null) {
    return (
      <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50">
        <Loader2 className="animate-spin" /> Cargando…
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <span className="mb-3 inline-grid h-16 w-16 place-items-center rounded-full bg-tinta text-white">
          <ShieldAlert size={32} />
        </span>
        <h2 className="font-display text-2xl font-black">Acceso restringido</h2>
        <p className="mt-1 font-semibold text-tinta/70">Esta zona es solo para administradores.</p>
        <Link href="/" className="mt-4 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
          Volver al inicio
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
